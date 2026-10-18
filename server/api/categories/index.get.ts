// Every category found on the vendor's places, with how many places use it and the style
// (icon + colour) the vendor chose for it, if any. `body` is the icon's SVG for map markers.
export default defineEventHandler(async (event) => {
	const vendor = await requireVendor(event);

	const [counts, styles] = await Promise.all([
		prisma.place.groupBy({
			by: ["category"],
			where: { vendorId: vendor.id },
			_count: { _all: true },
		}),
		prisma.categoryStyle.findMany({ where: { vendorId: vendor.id } }),
	]);
	const styleByName = new Map(styles.map((s) => [s.name, s]));

	const items = counts
		.map((c) => {
			const style = styleByName.get(c.category);
			return {
				name: c.category,
				count: c._count._all,
				icon: style?.icon ?? null,
				color: style?.color ?? null,
				body: style ? lucideBody(style.icon) : null,
			};
		})
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

	return { items };
});
