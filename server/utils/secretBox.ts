import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
} from "node:crypto";

// AES-256-GCM for secrets stored in the database (Google access tokens). The key is
// derived from SECRET_ENCRYPTION_KEY; changing it makes stored values unreadable.
function key(): Buffer {
	const secret = useRuntimeConfig().secretEncryptionKey;
	if (!secret) {
		throw createError({
			statusCode: 500,
			statusMessage: "SECRET_ENCRYPTION_KEY is not set",
		});
	}
	return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", key(), iv);
	const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
	return [iv, cipher.getAuthTag(), data]
		.map((b) => b.toString("base64"))
		.join(".");
}

export function decryptSecret(stored: string): string {
	const [iv, tag, data] = stored
		.split(".")
		.map((p) => Buffer.from(p, "base64"));
	if (!iv || !tag || !data) throw new Error("Malformed encrypted secret");
	const decipher = createDecipheriv("aes-256-gcm", key(), iv);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(data), decipher.final()]).toString(
		"utf8",
	);
}
