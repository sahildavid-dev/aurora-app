// Whether this vendor has a finished Google import on record, for the "connected" pill.
export default defineEventHandler(async (event) => {
	const vendor = await requireVendor(event);
	const last = await prisma.googleImport.findFirst({
		where: { vendorId: vendor.id, state: "COMPLETE" },
		orderBy: { createdAt: "desc" },
		select: { placeCount: true, finishedAt: true },
	});
	return {
		connected: last !== null,
		placeCount: last?.placeCount ?? 0,
		connectedAt: last?.finishedAt ?? null,
	};
});
