import { z } from "zod";

// Kept as a tuple so we can tell which fields a request actually touched
// (see below) independently of what zod parsed.
const PATCHABLE_FIELDS = [
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
	"notes",
	"tags",
	"rating",
	"visited",
	"sourceUrl",
	"googlePlaceId",
	"confidence",
	"status",
] as const;

const patchSchema = z.object({
	name: z.string().min(1, "name cannot be empty").optional(),
	category: z.string().min(1, "category cannot be empty").optional(),
	lat: z.number().nullable().optional(),
	lng: z.number().nullable().optional(),
	address: z.string().nullable().optional(),
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
	confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
	status: z.enum(["CONFIRMED", "NEEDS_REVIEW", "ARCHIVED"]).optional(),
});

/**
 * Manual edits win permanently: every field this request changes — even
 * setting it back to null, a deliberate clear — is added to `lockedFields`,
 * so a later agent capture's mergePlace() skips it rather than clobbering a
 * human's correction. Locks only ever accumulate here; this endpoint has no
 * way to unlock a field.
 */
export default defineEventHandler(async (event) => {
	assertMethod(event, "PATCH");
	const vendor = await requireVendor(event);
	const id = getRouterParam(event, "id");
	if (!id)
		throw createError({ statusCode: 400, statusMessage: "id is required" });

	const raw = (await readBody<Record<string, unknown>>(event)) ?? {};
	const parsed = patchSchema.safeParse(raw);
	if (!parsed.success) {
		throw createError({
			statusCode: 400,
			statusMessage: parsed.error.issues
				.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
				.join("; "),
		});
	}

	// A field only counts as "touched" if the request body actually included
	// the key — not just whether zod produced a value for it — so a field
	// the client never mentioned can't get swept into lockedFields.
	const touchedFields = PATCHABLE_FIELDS.filter((field) =>
		Object.hasOwn(raw, field),
	);
	if (touchedFields.length === 0) {
		throw createError({
			statusCode: 400,
			statusMessage: "No recognised fields to update",
		});
	}

	const existing = await prisma.place.findFirst({
		where: { id, vendorId: vendor.id },
	});
	if (!existing)
		throw createError({ statusCode: 404, statusMessage: "Place not found" });

	const data: Record<string, unknown> = {};
	for (const field of touchedFields) {
		data[field] = parsed.data[field];
	}

	data.lockedFields = Array.from(
		new Set([...existing.lockedFields, ...touchedFields]),
	);

	if (touchedFields.includes("name") && typeof data.name === "string") {
		data.nameKey = normaliseName(data.name);
	}

	try {
		return await prisma.place.update({ where: { id }, data });
	} catch (error) {
		console.error(`Failed to update place ${id}:`, error);
		throw createError({
			statusCode: 500,
			statusMessage: "Database error while updating place",
		});
	}
});
