export default defineEventHandler(async (event) => {
	assertMethod(event, "DELETE");
	const vendor = await requireVendor(event);
	const id = getRouterParam(event, "id");
	if (!id)
		throw createError({ statusCode: 400, statusMessage: "id is required" });

	const query = getQuery(event);
	const hard = query.hard === "true" || query.hard === "1";

	const existing = await prisma.place.findFirst({
		where: { id, vendorId: vendor.id },
	});
	if (!existing)
		throw createError({ statusCode: 404, statusMessage: "Place not found" });

	try {
		if (hard) {
			// Captures referencing this place have onDelete: SetNull, so they're
			// kept (with placeId cleared) rather than cascaded away.
			await prisma.place.delete({ where: { id } });
			return { ok: true, hard: true };
		}

		const place = await prisma.place.update({
			where: { id },
			data: { status: "ARCHIVED" },
		});
		return { ok: true, hard: false, place };
	} catch (error) {
		console.error(`Failed to delete place ${id}:`, error);
		throw createError({
			statusCode: 500,
			statusMessage: "Database error while deleting place",
		});
	}
});
