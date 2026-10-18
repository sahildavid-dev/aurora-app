import { z } from "zod";

const bodySchema = z.object({
	name: z.string().min(1),
	icon: z.string().min(1),
	color: z.string().regex(/^#[0-9a-f]{6}$/i, "color must be #rrggbb"),
});

// Saves the vendor's icon + colour for one category.
export default defineEventHandler(async (event) => {
	const vendor = await requireVendor(event);
	const parsed = bodySchema.safeParse(await readBody(event));
	if (!parsed.success) {
		throw createError({
			statusCode: 400,
			statusMessage: parsed.error.issues.map((i) => i.message).join("; "),
		});
	}
	const { name, icon, color } = parsed.data;
	const body = lucideBody(icon);
	if (!body)
		throw createError({
			statusCode: 400,
			statusMessage: `Unknown icon "${icon}"`,
		});

	await prisma.categoryStyle.upsert({
		where: { vendorId_name: { vendorId: vendor.id, name } },
		create: { vendorId: vendor.id, name, icon, color: color.toLowerCase() },
		update: { icon, color: color.toLowerCase() },
	});
	return { name, icon, color: color.toLowerCase(), body };
});
