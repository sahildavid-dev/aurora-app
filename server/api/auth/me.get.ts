export default defineEventHandler(async (event) => {
	return { vendor: await getVendor(event) };
});
