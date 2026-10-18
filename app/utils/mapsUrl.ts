// Opens a place itself on Google Maps, like searching for it: its saved Google link when we
// have one, otherwise a search for its name and address (or the bare point as a last resort).
export function googleMapsUrl(place: {
	name?: string | null;
	address?: string | null;
	lat: number;
	lng: number;
	sourceUrl?: string | null;
}): string {
	if (
		place.sourceUrl &&
		/^https?:\/\/(www\.)?google\.[a-z.]+\/maps/i.test(place.sourceUrl)
	) {
		return place.sourceUrl;
	}
	const query =
		[place.name, place.address].filter(Boolean).join(", ") ||
		`${place.lat},${place.lng}`;
	return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
