export interface PlaceRow {
	id: string;
	name: string;
	category: string;
	lat: number | null;
	lng: number | null;
	address: string | null;
	city: string | null;
	region: string | null;
	country: string | null;
	countryCode: string | null;
	geocodedAt: string | null;
	status: "CONFIRMED" | "NEEDS_REVIEW" | "ARCHIVED";
	notes: string | null;
	sourceUrl: string | null;
	createdAt: string;
}

interface PlacePage {
	items: PlaceRow[];
	nextCursor: string | null;
}

// The signed-in vendor's places, shared between the map and the table so switching
// pages doesn't refetch. `load()` pages through the API until everything is in.
export function usePlaces() {
	const places = useState<PlaceRow[]>("places", () => []);
	const loaded = useState("places-loaded", () => false);

	async function load() {
		const all: PlaceRow[] = [];
		let cursor: string | null = null;
		do {
			const page: PlacePage = await $fetch<PlacePage>("/api/places", {
				query: { limit: 200, ...(cursor ? { cursor } : {}) },
			});
			all.push(...page.items);
			cursor = page.nextCursor;
		} while (cursor);
		places.value = all;
		loaded.value = true;
	}

	// Fills in coordinates, city and country in the background, a small batch at a time,
	// until none are left. Shared state so the map and the table show the same progress.
	const enrichment = useState<
		"idle" | "running" | "done" | "unavailable" | "error"
	>("places-enrichment", () => "idle");
	const enrichLeft = useState("places-enrich-left", () => 0);
	const enrichError = useState("places-enrich-error", () => "");

	async function enrich() {
		if (enrichment.value === "running") return;
		enrichment.value = "running";
		enrichError.value = "";
		try {
			let remaining = 1;
			while (remaining > 0) {
				const res = await $fetch<{ processed: number; remaining: number }>(
					"/api/places/enrich",
					{ method: "POST" },
				);
				remaining = res.processed === 0 ? 0 : res.remaining;
				enrichLeft.value = res.remaining;
				await load();
			}
			enrichment.value = "done";
		} catch (e) {
			const err = e as {
				statusCode?: number;
				data?: { statusMessage?: string };
			};
			enrichError.value = err?.data?.statusMessage ?? "";
			enrichment.value = err?.statusCode === 503 ? "unavailable" : "error";
		}
	}

	// Plain-English version of whatever Google said; the raw text stays in the tooltip.
	const enrichNotice = computed(() => {
		const raw = enrichError.value;
		if (/REQUEST_DENIED/.test(raw)) {
			return "Google isn't accepting the location key. Check the geocoding key settings.";
		}
		if (/OVER_(DAILY_|QUERY_)?LIMIT/.test(raw)) {
			return "Google's location lookup limit was reached. Try again later.";
		}
		return "Some locations couldn't be looked up just now.";
	});

	/** Loads places, then starts the background fill-in if any place still needs it. */
	async function loadAndEnrich() {
		await load();
		if (places.value.some((p) => !p.geocodedAt)) enrich();
	}

	return {
		places,
		loaded,
		load,
		enrichment,
		enrichLeft,
		enrichError,
		enrichNotice,
		enrich,
		loadAndEnrich,
	};
}
