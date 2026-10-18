// Poll-driven: each call checks the export at Google and, once it is ready, downloads and
// saves the places. No background worker — the page polls while an import is running.
export default defineEventHandler(async (event) => {
	const vendor = await requireVendor(event);
	const id = getRouterParam(event, "id") ?? "";
	const row = await prisma.googleImport.findFirst({
		where: { id, vendorId: vendor.id },
	});
	if (!row)
		throw createError({ statusCode: 404, statusMessage: "Import not found" });

	const view = (r: typeof row) => ({
		state: r.state,
		placeCount: r.placeCount,
		error: r.error,
	});
	if (row.state !== "PENDING" || !row.accessTokenEnc || !row.archiveJobId)
		return view(row);

	const token = decryptSecret(row.accessTokenEnc);
	const fail = async (message: string) => {
		await resetAuthorization(token);
		return view(
			await prisma.googleImport.update({
				where: { id },
				data: {
					state: "FAILED",
					error: message,
					accessTokenEnc: null,
					finishedAt: new Date(),
				},
			}),
		);
	};

	try {
		const { state, urls } = await archiveState(token, row.archiveJobId);
		if (state === "FAILED")
			return await fail("Google could not prepare the export");
		if (state !== "COMPLETE") return view(row);

		// Claim the import so two overlapping polls don't both write.
		const claimed = await prisma.googleImport.updateMany({
			where: { id, state: "PENDING" },
			data: { state: "IMPORTING" },
		});
		if (claimed.count === 0) return view(row);

		const places: ParsedPlace[] = [];
		for (const url of urls) {
			const res = await fetch(url);
			if (!res.ok) throw new Error(`Download failed (${res.status})`);
			places.push(...parseArchive(new Uint8Array(await res.arrayBuffer())));
		}
		const placeCount = await savePlaces(vendor.id, places);
		await resetAuthorization(token);
		return view(
			await prisma.googleImport.update({
				where: { id },
				data: {
					state: "COMPLETE",
					placeCount,
					accessTokenEnc: null,
					finishedAt: new Date(),
				},
			}),
		);
	} catch (error) {
		console.error("Google import failed:", error);
		return await fail(error instanceof Error ? error.message : "Import failed");
	}
});
