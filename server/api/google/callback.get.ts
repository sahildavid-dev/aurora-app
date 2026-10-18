// Google redirects back here with ?code&state. Exchanges the code, starts the export job at
// Google, and sends the user home with the import id so the page can follow its progress.
export default defineEventHandler(async (event) => {
	const vendor = await requireVendor(event);
	const query = getQuery(event);
	const expected = getCookie(event, "aurora_oauth_state");
	deleteCookie(event, "aurora_oauth_state", { path: "/api/google" });

	if (query.error) return sendRedirect(event, "/?import_error=denied");
	if (!expected || query.state !== expected || typeof query.code !== "string") {
		throw createError({
			statusCode: 400,
			statusMessage: "Invalid OAuth state",
		});
	}

	let token: string | undefined;
	try {
		const exchanged = await exchangeCode(query.code);
		token = exchanged.token;
		const archiveJobId = await startArchive(token, exchanged.scope);
		const row = await prisma.googleImport.create({
			data: {
				vendorId: vendor.id,
				archiveJobId,
				accessTokenEnc: encryptSecret(token),
			},
		});
		return sendRedirect(event, `/?import=${row.id}`);
	} catch (error) {
		console.error("Google import start failed:", error);
		if (token) await resetAuthorization(token);
		const row = await prisma.googleImport.create({
			data: {
				vendorId: vendor.id,
				state: "FAILED",
				error:
					error instanceof Error ? error.message : "Could not start the export",
				finishedAt: new Date(),
			},
		});
		return sendRedirect(event, `/?import=${row.id}`);
	}
});
