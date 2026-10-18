import { z } from "zod";

const bodySchema = z.object({
	email: z.string().trim().toLowerCase().email(),
	password: z.string().min(1).max(200),
});

// Verified against this when the email is unknown, so a miss costs the same
// as a wrong password and doesn't reveal which emails exist.
const dummyHash = hashPassword("aurora-dummy-password");

export default defineEventHandler(async (event) => {
	const parsed = bodySchema.safeParse(await readBody(event));
	if (!parsed.success)
		throw createError({
			statusCode: 400,
			statusMessage: "Enter a valid email and password",
		});
	const { email, password } = parsed.data;

	const vendor = await prisma.vendor.findUnique({ where: { email } });
	const ok = await verifyPasswordHash(
		vendor?.passwordHash ?? (await dummyHash),
		password,
	);
	if (!vendor || !ok)
		throw createError({
			statusCode: 401,
			statusMessage: "Incorrect email or password",
		});

	await createSession(event, vendor.id);
	return { vendor: { id: vendor.id, email: vendor.email } };
});
