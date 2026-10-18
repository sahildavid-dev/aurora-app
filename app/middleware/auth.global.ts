// Everything except /login requires a signed-in vendor.
export default defineNuxtRouteMiddleware(async (to) => {
	const headers = import.meta.server
		? useRequestHeaders(["cookie"])
		: undefined;
	const { vendor } = await $fetch("/api/auth/me", { headers });
	if (!vendor && to.path !== "/login") return navigateTo("/login");
	if (vendor && to.path === "/login") return navigateTo("/");
});
