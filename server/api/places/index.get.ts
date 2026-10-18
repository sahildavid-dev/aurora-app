import type { Prisma } from "@prisma/client";
import { z } from "zod";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

const listQuerySchema = z.object({
	q: z.string().optional(),
	status: z.enum(["CONFIRMED", "NEEDS_REVIEW", "ARCHIVED"]).optional(),
	category: z.string().optional(),
	tag: z.string().optional(),
	// "minLng,minLat,maxLng,maxLat"
	bbox: z.string().optional(),
	limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
	cursor: z.string().optional(),
});

function parseBbox(bbox: string): {
	minLng: number;
	minLat: number;
	maxLng: number;
	maxLat: number;
} {
	const parts = bbox.split(",").map(Number);
	if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
		throw createError({
			statusCode: 400,
			statusMessage: 'bbox must be "minLng,minLat,maxLng,maxLat"',
		});
	}
	const [minLng, minLat, maxLng, maxLat] = parts as [
		number,
		number,
		number,
		number,
	];
	return { minLng, minLat, maxLng, maxLat };
}

export default defineEventHandler(async (event) => {
	const vendor = await requireVendor(event);
	const parsed = listQuerySchema.safeParse(getQuery(event));
	if (!parsed.success) {
		throw createError({
			statusCode: 400,
			statusMessage: parsed.error.issues
				.map((issue) => `${issue.path.join(".") || "query"}: ${issue.message}`)
				.join("; "),
		});
	}
	const query = parsed.data;

	const where: Prisma.PlaceWhereInput = { vendorId: vendor.id };
	if (query.status) where.status = query.status;
	if (query.category) where.category = query.category;
	if (query.tag) where.tags = { has: query.tag };
	if (query.q) {
		where.OR = [
			{ name: { contains: query.q, mode: "insensitive" } },
			{ address: { contains: query.q, mode: "insensitive" } },
		];
	}
	if (query.bbox) {
		const { minLng, minLat, maxLng, maxLat } = parseBbox(query.bbox);
		where.lat = { gte: minLat, lte: maxLat };
		where.lng = { gte: minLng, lte: maxLng };
	}

	// Fetch one extra row to know whether there's a next page without a
	// separate count query.
	const rows = await prisma.place.findMany({
		where,
		orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		take: query.limit + 1,
		...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
	});

	const hasMore = rows.length > query.limit;
	const items = hasMore ? rows.slice(0, query.limit) : rows;
	const nextCursor = hasMore ? (items.at(-1)?.id ?? null) : null;

	return { items, nextCursor };
});
