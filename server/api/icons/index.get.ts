// Names of every Lucide icon, for the category icon picker's search.
export default defineEventHandler(async (event) => {
	await requireVendor(event);
	return { icons: lucideNames };
});
