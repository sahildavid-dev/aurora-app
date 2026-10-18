// Runtime queries go through the PrismaPg driver adapter against DATABASE_URL (pooled); the
// Prisma CLI and migrations use DIRECT_URL instead, via prisma.config.ts.
//
// Lazy on purpose (built on first use, not at module import): server/utils/*.ts is
// auto-imported by Nitro at startup, before runtime config is guaranteed to be populated.
// The URL comes from the build-time-baked runtimeConfig rather than process.env, because
// Amplify's console env vars aren't reliably present in the Lambda runtime — see the
// comment above `runtimeConfig` in nuxt.config.ts.
import { PrismaPg } from "@prisma/adapter-pg";
import type { PrismaClient as PrismaClientType } from "@prisma/client";
// Default-import + destructure: the generated client's CJS build re-exports via a spread,
// which cjs-module-lexer can't analyze, so a named import throws under native ESM.
import prismaClientPkg from "@prisma/client";

const { PrismaClient } = prismaClientPkg;

// The adapter ignores `?schema=` in the URL (the Prisma CLI honours it, the pg driver does
// not), so the schema is passed explicitly. Must match the `?schema=` on DIRECT_URL.
const DATABASE_SCHEMA = "auroraapp";

function createPrismaClient(): PrismaClientType {
	const adapter = new PrismaPg(
		{ connectionString: useRuntimeConfig().databaseUrl },
		{ schema: DATABASE_SCHEMA },
	);
	return new PrismaClient({ adapter });
}

// Lambda reuses containers between invocations, and dev HMR re-evaluates this module;
// caching on globalThis avoids exhausting Postgres connections either way.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClientType };

export const prisma = new Proxy({} as PrismaClientType, {
	get(_target, prop) {
		globalForPrisma.prisma ??= createPrismaClient();
		return Reflect.get(globalForPrisma.prisma, prop);
	},
});
