// Seeds the vendor account from VENDOR_EMAIL / VENDOR_PASSWORD (read from .env).
// Create-only and idempotent: if the vendor already exists it is left untouched, so
// re-running on every deploy never resets a password or signs anyone out.
// To change the password, set VENDOR_RESET_PASSWORD=1 for one run.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import prismaClientPkg from "@prisma/client";
import { hashPassword } from "../server/utils/password";

const email = process.env.VENDOR_EMAIL?.trim().toLowerCase();
const password = process.env.VENDOR_PASSWORD;

if (!email || !password) {
	console.log("VENDOR_EMAIL / VENDOR_PASSWORD not set — skipping vendor seed");
	process.exit(0);
}
if (password.length < 10) {
	console.error("VENDOR_PASSWORD must be at least 10 characters");
	process.exit(1);
}

const prisma = new prismaClientPkg.PrismaClient({
	adapter: new PrismaPg(
		{ connectionString: process.env.DATABASE_URL },
		{ schema: "auroraapp" },
	),
});

const existing = await prisma.vendor.findUnique({ where: { email } });
if (existing && !process.env.VENDOR_RESET_PASSWORD) {
	console.log(`Vendor ${email} already exists — left unchanged`);
} else if (existing) {
	await prisma.vendor.update({
		where: { email },
		data: { passwordHash: await hashPassword(password) },
	});
	await prisma.session.deleteMany({ where: { vendorId: existing.id } });
	console.log(`Vendor ${email} password reset`);
} else {
	await prisma.vendor.create({
		data: { email, passwordHash: await hashPassword(password) },
	});
	console.log(`Vendor ${email} created`);
}
// Rows that predate ownership belong to this vendor (see the vendor_owns_places migration).
const owner = await prisma.vendor.findUniqueOrThrow({ where: { email } });
const whatsappNumber = process.env.VENDOR_WHATSAPP_NUMBER?.trim();
if (whatsappNumber) {
	await prisma.vendor.update({
		where: { id: owner.id },
		data: { whatsappNumber },
	});
}
const claimedPlaces = await prisma.place.updateMany({
	where: { vendorId: null },
	data: { vendorId: owner.id },
});
await prisma.capture.updateMany({
	where: { vendorId: null },
	data: { vendorId: owner.id },
});
if (claimedPlaces.count > 0)
	console.log(`Assigned ${claimedPlaces.count} unowned places to ${email}`);
await prisma.$disconnect();
