import { randomBytes } from "node:crypto";

// Starts the Google consent flow. The random `state` is bound to this browser by a
// short-lived cookie and checked again in the callback (CSRF protection).
export default defineEventHandler(async (event) => {
	await requireVendor(event);
	const { googleClientId, publicUrl } = useRuntimeConfig();
	if (!googleClientId || !publicUrl) {
		throw createError({
			statusCode: 500,
			statusMessage: "GOOGLE_CLIENT_ID / PUBLIC_URL are not set",
		});
	}

	const state = randomBytes(24).toString("base64url");
	setCookie(event, "aurora_oauth_state", state, {
		httpOnly: true,
		secure: !import.meta.dev,
		sameSite: "lax",
		path: "/api/google",
		maxAge: 10 * 60,
	});
	return sendRedirect(event, googleAuthUrl(state));
});
