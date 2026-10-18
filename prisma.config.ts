import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
	schema: "prisma/schema",
	migrations: {
		path: "prisma/migrations",
		seed: "tsx prisma/seed.ts",
	},
	datasource: {
		// Runtime queries use DATABASE_URL (pooled) through the PrismaPg adapter in
		// server/utils/prisma.ts — this is the direct connection, for the CLI/migrations only.
		url: env("DIRECT_URL"),
	},
});
