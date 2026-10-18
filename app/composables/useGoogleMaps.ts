let loading: Promise<typeof google.maps> | undefined;

// Loads the Maps JavaScript API once per page load and resolves with `google.maps`.
export function useGoogleMaps(): Promise<typeof google.maps> {
	if (loading) return loading;

	const apiKey = useRuntimeConfig().public.googleMapsApiKey;
	if (!apiKey) {
		return Promise.reject(new Error("GOOGLE_MAPS_API_KEY is not set"));
	}

	loading = new Promise((resolve, reject) => {
		const callback = "__initGoogleMaps";
		(window as unknown as Record<string, () => void>)[callback] = () =>
			resolve(google.maps);

		const script = document.createElement("script");
		script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&v=weekly&callback=${callback}`;
		script.async = true;
		script.onerror = () => {
			loading = undefined;
			reject(new Error("Failed to load the Google Maps script"));
		};
		document.head.append(script);
	});
	return loading;
}
