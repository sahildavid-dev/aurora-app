// Removes the vendor's style for a category, so it goes back to the default look.
export default defineEventHandler(async (event) => {
	const vendor = await requireVendor(event);
	const name = getQuery(event).name;
	if (typeof name !== "string" || !name) {
		throw createError({ statusCode: 400, statusMessage: "name is required" });
	}
	await prisma.categoryStyle.deleteMany({
		where: { vendorId: vendor.id, name },
	});
	return { ok: true };
});
