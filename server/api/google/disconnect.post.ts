// Disconnects Google: revokes any access still held (an export that was mid-flight) and
// forgets the import history. Imported places stay on the map — they are the vendor's data.
export default defineEventHandler(async (event) => {
	const vendor = await requireVendor(event);

	const open = await prisma.googleImport.findMany({
		where: { vendorId: vendor.id, accessTokenEnc: { not: null } },
		select: { accessTokenEnc: true },
	});
	for (const row of open) {
		if (row.accessTokenEnc)
			await resetAuthorization(decryptSecret(row.accessTokenEnc));
	}

	await prisma.googleImport.deleteMany({ where: { vendorId: vendor.id } });
	return { ok: true };
});
