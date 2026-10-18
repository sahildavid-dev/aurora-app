import type { Confidence, Place, PlaceStatus, Prisma } from "@prisma/client";
import { prisma } from "./prisma";

// --- Name normalisation --------------------------------------------------
//
// Used both to populate `nameKey` on write and to look candidates up on
// read, so a place saved as "The Ivy Restaurant" and one saved as "ivy"
// resolve to the same key.
const LEADING_ARTICLES = /^(the)\s+/;

const TRAILING_SUFFIXES = new Set([
	"restaurant",
	"cafe",
	"coffee",
	"bar",
	"hotel",
	"spa",
	"london",
	"ltd",
]);

export function normaliseName(name: string): string {
	const stripped = name
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "") // strip accents (combining diacritical marks)
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, " ") // strip punctuation
		.replace(/\s+/g, " ")
		.trim()
		.replace(LEADING_ARTICLES, "");

	const words = stripped.split(" ").filter(Boolean);
	// Strip trailing generic suffix words one at a time (e.g. "the ivy
	// london" -> "ivy london" -> "ivy"), but never down to nothing.
	let last = words.at(-1);
	while (
		words.length > 1 &&
		last !== undefined &&
		TRAILING_SUFFIXES.has(last)
	) {
		words.pop();
		last = words.at(-1);
	}

	return words.join(" ");
}

// --- Matching -------------------------------------------------------------
//
// ~150m bounding box: 0.00135 degrees of latitude is ~150m everywhere;
// longitude degrees shrink toward the poles, so the same physical distance
// needs dividing by cos(latitude) to get the equivalent longitude delta.
const BBOX_DELTA_LAT = 0.00135;

export interface MatchCandidate {
	vendorId: string;
	googlePlaceId?: string | null;
	nameKey: string;
	lat?: number | null;
	lng?: number | null;
}

// Accepts either the plain client or a `$transaction` callback's client, so
// the agent's upsert endpoint can match-and-write atomically (see
// server/api/internal/places/upsert.post.ts) — a full PrismaClient is
// structurally assignable to Prisma.TransactionClient, so the plain
// `prisma` default works for any other, non-transactional caller.
export async function findMatch(
	candidate: MatchCandidate,
	db: Prisma.TransactionClient = prisma,
): Promise<Place | null> {
	if (candidate.googlePlaceId) {
		const byGoogleId = await db.place.findUnique({
			where: {
				vendorId_googlePlaceId: {
					vendorId: candidate.vendorId,
					googlePlaceId: candidate.googlePlaceId,
				},
			},
		});
		if (byGoogleId) return byGoogleId;
	}

	if (candidate.lat != null && candidate.lng != null) {
		const deltaLng = BBOX_DELTA_LAT / Math.cos((candidate.lat * Math.PI) / 180);
		const nearby = await db.place.findMany({
			where: {
				vendorId: candidate.vendorId,
				nameKey: candidate.nameKey,
				lat: {
					gte: candidate.lat - BBOX_DELTA_LAT,
					lte: candidate.lat + BBOX_DELTA_LAT,
				},
				lng: { gte: candidate.lng - deltaLng, lte: candidate.lng + deltaLng },
			},
			take: 1,
		});
		return nearby[0] ?? null;
	}

	// No coordinates: nameKey alone, but only when it's unambiguous — two or
	// more hits means we can't tell which one this is, so leave it to create
	// a new record for manual review rather than guess.
	const byName = await db.place.findMany({
		where: { vendorId: candidate.vendorId, nameKey: candidate.nameKey },
		take: 2,
	});
	return byName.length === 1 ? (byName[0] ?? null) : null;
}

// --- Merging ----------------------------------------------------------
const CONFIDENCE_RANK: Record<Confidence, number> = {
	LOW: 0,
	MEDIUM: 1,
	HIGH: 2,
};

export interface IncomingPlaceData {
	name: string;
	category: string;
	lat: number | null;
	lng: number | null;
	address: string | null;
	description: string | null;
	hours: string | null;
	phone: string | null;
	website: string | null;
	instagram: string | null;
	facebook: string | null;
	twitter: string | null;
	tiktok: string | null;
	sourceUrl: string | null;
	notes: string | null;
	confidence: Confidence;
}

// Plain scalar fields that follow the generic overwrite rule below. `name`
// gets nameKey recomputed alongside it; `notes`, `confidence` and `status`
// each have their own rule and are handled separately.
const MERGEABLE_FIELDS = [
	"name",
	"category",
	"lat",
	"lng",
	"address",
	"description",
	"hours",
	"phone",
	"website",
	"instagram",
	"facebook",
	"twitter",
	"tiktok",
	"sourceUrl",
] as const satisfies readonly (keyof IncomingPlaceData)[];

function isEmpty(value: unknown): boolean {
	return value === null || value === undefined || value === "";
}

export function mergePlace(
	existing: Place,
	incoming: IncomingPlaceData,
): { data: Record<string, unknown>; changedFields: string[] } {
	const data: Record<string, unknown> = {};
	const changedFields: string[] = [];
	const locked = new Set(existing.lockedFields);

	// "Equal to or higher" — an equal-confidence re-capture is still allowed
	// to overwrite (e.g. a corrected phone number from the same web search).
	const incomingOutranks =
		CONFIDENCE_RANK[incoming.confidence] >=
		CONFIDENCE_RANK[existing.confidence];

	for (const field of MERGEABLE_FIELDS) {
		if (locked.has(field)) continue;

		const incomingValue = incoming[field];
		if (isEmpty(incomingValue)) continue; // never write null/empty over anything

		const existingValue = existing[field];
		const canWrite = isEmpty(existingValue) || incomingOutranks; // fill blanks regardless of confidence
		if (canWrite && existingValue !== incomingValue) {
			data[field] = incomingValue;
			changedFields.push(field);
		}
	}

	if (changedFields.includes("name")) {
		// Keep the dedupe key in sync with any name write, from whatever rule
		// let it through above.
		data.nameKey = normaliseName(incoming.name);
	}

	// notes is the owner's personal commentary — never overwritten, and never
	// silently dropped just because it duplicates existing text.
	if (!locked.has("notes") && incoming.notes) {
		const existingNotes = existing.notes ?? "";
		if (!existingNotes.includes(incoming.notes)) {
			data.notes = existingNotes
				? `${existingNotes}\n${incoming.notes}`
				: incoming.notes;
			changedFields.push("notes");
		}
	}

	const resultConfidence: Confidence =
		CONFIDENCE_RANK[incoming.confidence] > CONFIDENCE_RANK[existing.confidence]
			? incoming.confidence
			: existing.confidence;
	if (resultConfidence !== existing.confidence) {
		data.confidence = resultConfidence;
		changedFields.push("confidence");
	}

	if (existing.status !== "CONFIRMED") {
		const nextStatus: PlaceStatus =
			resultConfidence === "HIGH" ? "CONFIRMED" : "NEEDS_REVIEW";
		if (nextStatus !== existing.status) {
			data.status = nextStatus;
			changedFields.push("status");
		}
	}

	return { data, changedFields };
}

// --- Capture ownership ------------------------------------------------------
//
// A WhatsApp capture belongs to the vendor whose `whatsappNumber` sent it. While there is
// exactly one vendor, an unmatched number falls back to them (the app's original
// single-owner behaviour); with several vendors an unknown number is rejected.
export async function resolveCaptureVendorId(from: string): Promise<string> {
	const number = from.replace(/^whatsapp:/, "").trim();
	const byNumber = await prisma.vendor.findUnique({
		where: { whatsappNumber: number },
		select: { id: true },
	});
	if (byNumber) return byNumber.id;

	const vendors = await prisma.vendor.findMany({
		select: { id: true },
		take: 2,
	});
	if (vendors.length === 1 && vendors[0]) return vendors[0].id;

	throw createError({
		statusCode: 422,
		statusMessage: `No vendor is linked to ${number}`,
	});
}
