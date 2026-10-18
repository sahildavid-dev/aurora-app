import { z } from "zod";

const createSchema = z.object({
	name: z.string().min(1, "name is required"),
	category: z.string().min(1, "category is required"),
	lat: z.number().nullable().optional(),
	lng: z.number().nullable().optional(),
	address: z.string().nullable().optional(),
	city: z.string().nullable().optional(),
	region: z.string().nullable().optional(),
	country: z.string().nullable().optional(),
	countryCode: z.string().nullable().optional(),
	description: z.string().nullable().optional(),
	hours: z.string().nullable().optional(),
	phone: z.string().nullable().optional(),
	website: z.string().nullable().optional(),
	instagram: z.string().nullable().optional(),
	facebook: z.string().nullable().optional(),
	twitter: z.string().nullable().optional(),
	tiktok: z.string().nullable().optional(),
	notes: z.string().nullable().optional(),
	tags: z.array(z.string()).optional(),
	rating: z.number().int().nullable().optional(),
	visited: z.boolean().optional(),
	sourceUrl: z.string().nullable().optional(),
	googlePlaceId: z.string().nullable().optional(),
	// A manual entry is, by construction, already reviewed by the owner —
	// default to HIGH/CONFIRMED rather than landing in the same review queue
	// as an unverified agent capture. Still overridable for bulk imports of
	// less-certain data through this same endpoint.
	confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
	status: z.enum(["CONFIRMED", "NEEDS_REVIEW", "ARCHIVED"]).optional(),
});

export default defineEventHandler(async (event) => {
	assertMethod(event, "POST");
	const vendor = await requireVendor(event);

	const raw = await readBody(event);
	const parsed = createSchema.safeParse(raw);
	if (!parsed.success) {
		throw createError({
			statusCode: 400,
			statusMessage: parsed.error.issues
				.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
				.join("; "),
		});
	}
	const body = parsed.data;
	const confidence = body.confidence ?? "HIGH";
	const status =
		body.status ?? (confidence === "HIGH" ? "CONFIRMED" : "NEEDS_REVIEW");

	try {
		const place = await prisma.place.create({
			data: {
				...body,
				// Location supplied by the add-place panel counts as already geocoded.
				...(body.country || body.city ? { geocodedAt: new Date() } : {}),
				vendorId: vendor.id,
				nameKey: normaliseName(body.name),
				confidence,
				status,
			},
		});
		setResponseStatus(event, 201);
		return place;
	} catch (error) {
		console.error("Failed to create place:", error);
		throw createError({
			statusCode: 500,
			statusMessage: "Database error while creating place",
		});
	}
});
