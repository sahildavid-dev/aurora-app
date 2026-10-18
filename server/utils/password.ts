// Explicit import, not Nitro's auto-import — this file is also imported directly by
// prisma/seed.ts (plain tsx), outside any Nuxt/Nitro build context.
import { argon2id, hash, verify } from "argon2";

// `type: argon2id` passed explicitly, not relied on as the library's default, so a
// future version bump changing the default can't silently weaken this.
export async function hashPassword(plain: string): Promise<string> {
	return hash(plain, { type: argon2id });
}

export async function verifyPasswordHash(
	passwordHash: string,
	plain: string,
): Promise<boolean> {
	try {
		return await verify(passwordHash, plain);
	} catch {
		return false;
	}
}
