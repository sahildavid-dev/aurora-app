import { createHash, randomBytes } from "node:crypto";
import type { H3Event } from "h3";

const COOKIE = "aurora_session";
const SESSION_DAYS = 30;

const hashToken = (token: string) =>
	createHash("sha256").update(token).digest("hex");

export async function createSession(event: H3Event, vendorId: string) {
	const token = randomBytes(32).toString("base64url");
	const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
	await prisma.session.create({
		data: { tokenHash: hashToken(token), vendorId, expiresAt },
	});
	setCookie(event, COOKIE, token, {
		httpOnly: true,
		secure: !import.meta.dev,
		sameSite: "lax",
		path: "/",
		expires: expiresAt,
	});
}

export async function destroySession(event: H3Event) {
	const token = getCookie(event, COOKIE);
	if (token)
		await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
	deleteCookie(event, COOKIE, { path: "/" });
}

/** The signed-in vendor, or null. */
export async function getVendor(event: H3Event) {
	const token = getCookie(event, COOKIE);
	if (!token) return null;
	const session = await prisma.session.findUnique({
		where: { tokenHash: hashToken(token) },
		include: { vendor: { select: { id: true, email: true } } },
	});
	if (!session || session.expiresAt < new Date()) return null;
	return session.vendor;
}

/** For protected endpoints: the signed-in vendor, or a 401. */
export async function requireVendor(event: H3Event) {
	const vendor = await getVendor(event);
	if (!vendor)
		throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
	return vendor;
}
