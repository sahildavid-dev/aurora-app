export default defineEventHandler(async (event) => {
	const vendor = await requireVendor(event);
	const id = getRouterParam(event, "id");
	if (!id)
		throw createError({ statusCode: 400, statusMessage: "id is required" });

	const place = await prisma.place.findFirst({
		where: { id, vendorId: vendor.id },
		include: { captures: { orderBy: { createdAt: "desc" } } },
	});
	if (!place)
		throw createError({ statusCode: 404, statusMessage: "Place not found" });

	return place;
});
