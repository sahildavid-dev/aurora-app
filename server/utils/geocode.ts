// Reverse-geocodes places with the Google Geocoding API to fill city / region / country.
// Needs a SERVER key (GOOGLE_GEOCODING_API_KEY): the browser Maps key is referrer-restricted,
// which Google rejects for server-side calls.
const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

// `fatal` errors (bad key, quota, Google outage) should stop a run and be retried later; a
// non-fatal one (e.g. INVALID_REQUEST for a name Google can't read) only concerns that place.
export class GeocodeError extends Error {
	constructor(
		message: string,
		readonly fatal: boolean,
	) {
		super(message);
	}
}

function failure(status: string, detail?: string): GeocodeError {
	const fatal = status !== "INVALID_REQUEST";
	return new GeocodeError(
		`Geocoding ${status}: ${detail ?? "request failed"}`,
		fatal,
	);
}

export interface GeocodedLocation {
	/** Google's formatted address; used for the add-place panel, never written by enrichment. */
	formattedAddress: string | null;
	city: string | null;
	region: string | null;
	country: string | null;
	countryCode: string | null;
}

interface AddressComponent {
	long_name: string;
	short_name: string;
	types: string[];
}

function pick(components: AddressComponent[], ...types: string[]) {
	for (const type of types) {
		const found = components.find((c) => c.types.includes(type));
		if (found) return found;
	}
	return undefined;
}

export function geocodingConfigured(): boolean {
	return Boolean(useRuntimeConfig().googleGeocodingApiKey);
}

// Returns null when Google has no result; throws on API/quota errors so the caller can stop.
export async function geocodePlace(place: {
	lat: number | null;
	lng: number | null;
	address: string | null;
}): Promise<GeocodedLocation | null> {
	const key = useRuntimeConfig().googleGeocodingApiKey;
	const params = new URLSearchParams({ key, language: "en" });
	if (place.lat !== null && place.lng !== null) {
		params.set("latlng", `${place.lat},${place.lng}`);
	} else if (place.address) {
		params.set("address", place.address);
	} else {
		return null;
	}

	const res = await fetch(`${GEOCODE_URL}?${params}`);
	const body = (await res.json()) as {
		status: string;
		error_message?: string;
		results?: {
			address_components: AddressComponent[];
			formatted_address?: string;
		}[];
	};
	if (body.status === "ZERO_RESULTS") return null;
	if (body.status !== "OK") {
		throw failure(body.status, body.error_message);
	}

	return fromComponents(
		body.results?.[0]?.address_components ?? [],
		body.results?.[0]?.formatted_address ?? null,
	);
}

function fromComponents(
	components: AddressComponent[],
	formattedAddress: string | null,
): GeocodedLocation {
	const country = pick(components, "country");
	return {
		formattedAddress,
		city:
			pick(
				components,
				"locality",
				"postal_town",
				"administrative_area_level_3",
				"administrative_area_level_2",
				"sublocality",
			)?.long_name ?? null,
		region: pick(components, "administrative_area_level_1")?.long_name ?? null,
		country: country?.long_name ?? null,
		countryCode: country?.short_name ?? null,
	};
}

export interface FoundPlace extends GeocodedLocation {
	lat: number;
	lng: number;
}

// Finds a place from its name when the saved-list export gave no coordinates. Uses the Places
// API (New) text search; if that API is not enabled for the key, falls back to forward geocoding.
export async function findPlaceByName(
	query: string,
): Promise<FoundPlace | null> {
	const key = useRuntimeConfig().googleGeocodingApiKey;
	const res = await fetch(
		"https://places.googleapis.com/v1/places:searchText",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Goog-Api-Key": key,
				"X-Goog-FieldMask":
					"places.location,places.formattedAddress,places.addressComponents",
			},
			body: JSON.stringify({
				textQuery: query,
				maxResultCount: 1,
				languageCode: "en",
			}),
		},
	);

	if (res.ok) {
		const body = (await res.json()) as {
			places?: {
				location?: { latitude: number; longitude: number };
				formattedAddress?: string;
				addressComponents?: {
					longText: string;
					shortText: string;
					types: string[];
				}[];
			}[];
		};
		const found = body.places?.[0];
		if (!found?.location) return null;
		const components: AddressComponent[] = (found.addressComponents ?? []).map(
			(c) => ({
				long_name: c.longText,
				short_name: c.shortText,
				types: c.types,
			}),
		);
		return {
			lat: found.location.latitude,
			lng: found.location.longitude,
			...fromComponents(components, found.formattedAddress ?? null),
		};
	}

	// Places API (New) not enabled / not allowed for this key: use the Geocoding API instead.
	if (res.status === 403) return geocodeByAddress(query);
	throw new GeocodeError(
		`Places search failed (${res.status})`,
		res.status >= 500 || res.status === 429,
	);
}

async function geocodeByAddress(query: string): Promise<FoundPlace | null> {
	const key = useRuntimeConfig().googleGeocodingApiKey;
	const params = new URLSearchParams({ key, language: "en", address: query });
	const res = await fetch(`${GEOCODE_URL}?${params}`);
	const body = (await res.json()) as {
		status: string;
		error_message?: string;
		results?: {
			address_components: AddressComponent[];
			formatted_address?: string;
			geometry?: { location?: { lat: number; lng: number } };
		}[];
	};
	if (body.status === "ZERO_RESULTS") return null;
	if (body.status !== "OK") {
		throw failure(body.status, body.error_message);
	}
	const top = body.results?.[0];
	if (!top?.geometry?.location) return null;
	return {
		lat: top.geometry.location.lat,
		lng: top.geometry.location.lng,
		...fromComponents(top.address_components, top.formatted_address ?? null),
	};
}
