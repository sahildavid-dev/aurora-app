import { z } from "zod";

const querySchema = z.object({
	lat: z.coerce.number().min(-90).max(90),
	lng: z.coerce.number().min(-180).max(180),
});

// Address, city and country for a point the vendor clicked on the map (add-place panel).
export default defineEventHandler(async (event) => {
	await requireVendor(event);
	const parsed = querySchema.safeParse(getQuery(event));
	if (!parsed.success) {
		throw createError({
			statusCode: 400,
			statusMessage: "lat and lng are required",
		});
	}
	if (!geocodingConfigured()) {
		throw createError({
			statusCode: 503,
			statusMessage: "GOOGLE_GEOCODING_API_KEY is not set",
		});
	}
	try {
		const location = await geocodePlace({ ...parsed.data, address: null });
		return { location };
	} catch (error) {
		throw createError({
			statusCode: 502,
			statusMessage:
				error instanceof Error ? error.message : "Geocoding failed",
		});
	}
});
