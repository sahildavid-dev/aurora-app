import type { Confidence } from "@prisma/client";
import { strFromU8, unzipSync } from "fflate";

// Google Data Portability API — pulls the user's Maps Starred places (GeoJSON) and their saved
// collections (Favourites, Want to go, custom lists). Both scopes are requested together; the
// export job is started for whichever ones the user actually granted.
// https://developers.google.com/data-portability
const SCOPE_PREFIX = "https://www.googleapis.com/auth/dataportability.";
const RESOURCES = ["maps.starred_places", "saved.collections"];
export const PORTABILITY_SCOPES = RESOURCES.map((r) => `${SCOPE_PREFIX}${r}`);
const PORTABILITY_API = "https://dataportability.googleapis.com/v1";

// GOOGLE_REDIRECT_URI overrides the default so local dev can use http://localhost:3001 while
// PUBLIC_URL points at an ngrok tunnel (for Twilio). It must match the OAuth client exactly.
export function googleRedirectUri(): string {
	const { googleRedirectUri: override, publicUrl } = useRuntimeConfig();
	return override || `${publicUrl.replace(/\/$/, "")}/api/google/callback`;
}

export function googleAuthUrl(state: string): string {
	const { googleClientId } = useRuntimeConfig();
	const params = new URLSearchParams({
		client_id: googleClientId,
		redirect_uri: googleRedirectUri(),
		response_type: "code",
		scope: PORTABILITY_SCOPES.join(" "),
		state,
		prompt: "consent",
	});
	return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCode(
	code: string,
): Promise<{ token: string; scope: string }> {
	const { googleClientId, googleClientSecret } = useRuntimeConfig();
	const res = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			code,
			client_id: googleClientId,
			client_secret: googleClientSecret,
			redirect_uri: googleRedirectUri(),
			grant_type: "authorization_code",
		}),
	});
	const body = (await res.json()) as {
		access_token?: string;
		scope?: string;
		error_description?: string;
	};
	if (!res.ok || !body.access_token) {
		throw new Error(
			body.error_description ?? `Token exchange failed (${res.status})`,
		);
	}
	return { token: body.access_token, scope: body.scope ?? "" };
}

async function portability<T>(
	path: string,
	token: string,
	init?: RequestInit,
): Promise<T> {
	const res = await fetch(`${PORTABILITY_API}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json; charset=utf-8",
		},
	});
	const body = (await res.json().catch(() => ({}))) as T & {
		error?: { message?: string };
	};
	if (!res.ok) {
		throw new Error(
			body.error?.message ?? `Data Portability API error (${res.status})`,
		);
	}
	return body;
}

// `grantedScope` is the space-separated scope string from the token response; only resource
// groups the user actually granted may be requested, or the API errors.
export async function startArchive(
	token: string,
	grantedScope: string,
): Promise<string> {
	const granted = grantedScope.split(" ");
	const resources = RESOURCES.filter((r) =>
		granted.includes(`${SCOPE_PREFIX}${r}`),
	);
	if (resources.length === 0)
		throw new Error("No Google Maps data access was granted");
	const { archiveJobId } = await portability<{ archiveJobId: string }>(
		"/portabilityArchive:initiate",
		token,
		{
			method: "POST",
			body: JSON.stringify({ resources }),
		},
	);
	return archiveJobId;
}

// The API allows one grant per user and refuses a second consent while it exists ("Incremental
// auth is not allowed"). Resetting revokes it, so call this once the token is no longer needed
// (after the archive is downloaded, or when the job fails) to keep "Import again" working.
// Best effort: a failure here must never break the import itself.
export async function resetAuthorization(token: string): Promise<void> {
	try {
		await portability("/authorization:reset", token, {
			method: "POST",
			body: "{}",
		});
	} catch (error) {
		console.warn("Could not reset Google authorization:", error);
	}
}

export async function archiveState(
	token: string,
	jobId: string,
): Promise<{ state: string; urls: string[] }> {
	const body = await portability<{ state?: string; urls?: string[] }>(
		`/archiveJobs/${encodeURIComponent(jobId)}/portabilityArchiveState`,
		token,
	);
	return { state: body.state ?? "", urls: body.urls ?? [] };
}

// --- Parsing --------------------------------------------------------------

export interface ParsedPlace {
	name: string;
	/** The Google list it came from ("Starred", "Favourite places", a custom list...). */
	category: string;
	lat: number | null;
	lng: number | null;
	address: string | null;
	sourceUrl: string | null;
	notes: string | null;
	confidence: Confidence;
}

type Json = Record<string, unknown>;
const asObj = (v: unknown): Json | undefined =>
	v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : undefined;
const asStr = (v: unknown): string | null =>
	typeof v === "string" && v.trim() ? v.trim() : null;

// "Want to go.csv" -> "Want to go"; "starred_places.json" -> "Starred".
function listName(path: string): string {
	const base = (path.split("/").pop() ?? path).replace(/\.[^.]+$/, "");
	if (/starred/i.test(path)) return "Starred";
	return base.replace(/[_-]+/g, " ").trim() || "Saved";
}

// Coordinates embedded in a Google Maps URL (!3d<lat>!4d<lng>, @lat,lng or ?q=lat,lng).
function coordsFromUrl(
	url: string | null,
): { lat: number; lng: number } | null {
	if (!url) return null;
	const m =
		url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ??
		url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ??
		url.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/) ??
		url.match(/\/search\/(-?\d+\.\d+),\+?(-?\d+\.\d+)/);
	return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}

// Saved lists also hold web links and images; only Google Maps links are places.
function isMapsUrl(url: string | null): boolean {
	return (
		url !== null &&
		/^https?:\/\/(([a-z]+\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(
			url,
		)
	);
}

// Minimal RFC 4180 CSV reader (quoted fields, "" escapes, embedded newlines).
function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c === '"' && text[i + 1] === '"') {
				field += '"';
				i++;
			} else if (c === '"') quoted = false;
			else field += c;
		} else if (c === '"') quoted = true;
		else if (c === ",") {
			row.push(field);
			field = "";
		} else if (c === "\n" || c === "\r") {
			if (c === "\r" && text[i + 1] === "\n") i++;
			row.push(field);
			field = "";
			if (row.some((v) => v !== "")) rows.push(row);
			row = [];
		} else field += c;
	}
	row.push(field);
	if (row.some((v) => v !== "")) rows.push(row);
	return rows;
}

function parseCsvPlaces(text: string, category: string): ParsedPlace[] {
	const [header, ...rows] = parseCsv(text.replace(/^\uFEFF/, ""));
	if (!header) return [];
	const col = (name: string) =>
		header.findIndex((h) => h.trim().toLowerCase() === name);
	const [title, note, url, comment] = ["title", "note", "url", "comment"].map(
		col,
	);
	if (title === undefined || title < 0) return [];

	const places: ParsedPlace[] = [];
	for (const r of rows) {
		const name = asStr(r[title]);
		if (!name) continue;
		const sourceUrl = asStr(url !== undefined && url >= 0 ? r[url] : null);
		if (!isMapsUrl(sourceUrl)) continue;
		const at = coordsFromUrl(sourceUrl);
		places.push({
			name,
			category,
			lat: at?.lat ?? null,
			lng: at?.lng ?? null,
			address: null,
			sourceUrl,
			notes:
				asStr(note !== undefined && note >= 0 ? r[note] : null) ??
				asStr(comment !== undefined && comment >= 0 ? r[comment] : null),
			confidence: at ? "HIGH" : "MEDIUM",
		});
	}
	return places;
}

// The export is a zip (or a bare file). The docs describe the Starred places GeoJSON but not
// the saved-collections layout, so this reads every .json/.geojson (GeoJSON features) and
// .csv (Takeout-style Title/Note/URL) entry, names each place's list after its file, and
// logs anything it could not read so the format can be adjusted against a real export.
export function parseArchive(buffer: Uint8Array): ParsedPlace[] {
	const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;
	const entries: [string, string][] = isZip
		? Object.entries(unzipSync(buffer)).map(([n, d]) => [n, strFromU8(d)])
		: [["export.json", strFromU8(buffer)]];

	const places: ParsedPlace[] = [];
	for (const [path, text] of entries) {
		const list = listName(path);
		let found: ParsedPlace[] = [];
		if (/\.csv$/i.test(path)) {
			found = parseCsvPlaces(text, list);
		} else if (/\.(geo)?json$/i.test(path)) {
			try {
				const doc = JSON.parse(text);
				const features = (asObj(doc)?.features ??
					(Array.isArray(doc) ? doc : [])) as unknown[];
				for (const f of features) {
					const place = parseFeature(asObj(f), list);
					if (place) found.push(place);
				}
			} catch {
				// handled by the log below
			}
		}
		console.log(`[google import] ${path}: ${found.length} places (${list})`);
		if (found.length === 0) {
			console.log(
				`[google import] unread entry ${path}: ${text.slice(0, 300)}`,
			);
		}
		places.push(...found);
	}
	// Starred first, so a place that is also in a named list ends up labelled with that list.
	return places.sort(
		(a, b) =>
			Number(b.category === "Starred") - Number(a.category === "Starred"),
	);
}

function parseFeature(
	feature: Json | undefined,
	category: string,
): ParsedPlace | null {
	if (!feature) return null;
	const props = asObj(feature.properties) ?? feature;
	const rawLocation = props.location ?? props.Location;
	const location =
		asObj(Array.isArray(rawLocation) ? rawLocation[0] : rawLocation) ?? {};

	const name =
		asStr(location.name) ??
		asStr(location.Name) ??
		asStr(props.Title) ??
		asStr(props.title) ??
		asStr(props.name);
	if (!name) return null;

	const sourceUrl =
		asStr(props.google_maps_url) ?? asStr(props["Google Maps URL"]);
	const coords = asObj(feature.geometry)?.coordinates;
	let lat: number | null = null;
	let lng: number | null = null;
	if (
		Array.isArray(coords) &&
		typeof coords[0] === "number" &&
		typeof coords[1] === "number"
	) {
		// GeoJSON order is [longitude, latitude]; 0,0 means "unknown".
		if (coords[0] !== 0 || coords[1] !== 0) {
			lng = coords[0];
			lat = coords[1];
		}
	}
	if (lat === null) {
		const at = coordsFromUrl(sourceUrl);
		if (at) ({ lat, lng } = at);
	}

	return {
		name,
		category,
		lat,
		lng,
		address:
			asStr(location.address) ??
			asStr(location.Address) ??
			asStr(props.address),
		sourceUrl,
		notes: asStr(props.Comment) ?? asStr(props.comment) ?? asStr(props.note),
		confidence: lat !== null ? "HIGH" : "MEDIUM",
	};
}

// Saves parsed places through the same match/merge rules as every other write path.
export async function savePlaces(
	vendorId: string,
	places: ParsedPlace[],
): Promise<number> {
	let saved = 0;
	for (const p of places) {
		const nameKey = normaliseName(p.name);
		if (!nameKey) continue;
		const incoming: IncomingPlaceData = {
			name: p.name,
			category: p.category,
			lat: p.lat,
			lng: p.lng,
			address: p.address,
			description: null,
			hours: null,
			phone: null,
			website: null,
			instagram: null,
			facebook: null,
			twitter: null,
			tiktok: null,
			sourceUrl: p.sourceUrl,
			notes: p.notes,
			confidence: p.confidence,
		};
		const match = await findMatch({
			vendorId,
			nameKey,
			lat: p.lat,
			lng: p.lng,
		});
		if (!match) {
			await prisma.place.create({
				data: {
					...incoming,
					vendorId,
					nameKey,
					status: p.confidence === "HIGH" ? "CONFIRMED" : "NEEDS_REVIEW",
				},
			});
		} else {
			const { data, changedFields } = mergePlace(match, incoming);
			if (changedFields.length > 0) {
				await prisma.place.update({ where: { id: match.id }, data });
			}
		}
		saved++;
	}
	return saved;
}
