<script setup lang="ts">
import type { MapPin } from "~/components/MapCanvas.client.vue";

interface ImportView {
	state: "PENDING" | "IMPORTING" | "COMPLETE" | "FAILED";
	placeCount: number;
	error: string | null;
}

const route = useRoute();
const { places, load: loadPlaces, loadAndEnrich } = usePlaces();
const pins = computed<MapPin[]>(() =>
	places.value.flatMap((p) =>
		p.lat !== null && p.lng !== null
			? [
					{
						id: p.id,
						name: p.name,
						lat: p.lat,
						lng: p.lng,
						address: p.address,
						sourceUrl: p.sourceUrl,
						category: p.category,
					},
				]
			: [],
	),
);
const importView = ref<ImportView>();
// A clicked map point; while set, the add-place panel is open.
const { styles: categoryStyles, load: loadCategoryStyles } =
	useCategoryStyles();
// The pin whose card is open. Picking a point on the map and selecting a pin are exclusive.
const selected = ref<MapPin | null>(null);
const draft = ref<{ lat: number; lng: number } | null>(null);
const categories = computed(() => [
	...new Set(places.value.map((p) => p.category)),
]);
async function onSaved() {
	draft.value = null;
	await loadPlaces();
}

const connectedCount = ref<number | null>(null);
// A live import (or its result) wins; otherwise fall back to the saved connection.
const importState = computed(
	() =>
		importView.value?.state ??
		(connectedCount.value !== null ? "COMPLETE" : "idle"),
);
const importCount = computed(
	() => importView.value?.placeCount ?? connectedCount.value ?? 0,
);

async function disconnect() {
	await $fetch("/api/google/disconnect", { method: "POST" });
	importView.value = undefined;
	connectedCount.value = null;
}

// Follows a Google import: polls while Google prepares the export, then reloads the map.
async function followImport(id: string) {
	do {
		importView.value = await $fetch<ImportView>(`/api/google/import/${id}`);
		if (importView.value.state === "COMPLETE") await loadPlaces();
		if (
			importView.value.state === "PENDING" ||
			importView.value.state === "IMPORTING"
		) {
			await new Promise((r) => setTimeout(r, 3000));
		}
	} while (
		importView.value.state === "PENDING" ||
		importView.value.state === "IMPORTING"
	);
	await navigateTo("/", { replace: true });
}

onMounted(async () => {
	$fetch<{ connected: boolean; placeCount: number }>("/api/google/status")
		.then((s) => {
			connectedCount.value = s.connected ? s.placeCount : null;
		})
		.catch(() => {});
	loadCategoryStyles().catch(() => {});
	await loadAndEnrich().catch(() => {});
	const id = route.query.import;
	if (typeof id === "string") await followImport(id);
	else if (route.query.import_error) {
		importView.value = {
			state: "FAILED",
			placeCount: 0,
			error: "Google access was not granted.",
		};
	}
});
</script>

<template>
	<div class="relative size-full">
		<MapCanvas
			:pins="pins"
			:styles="categoryStyles"
			:draft="draft"
			@pick="
				selected = null;
				draft = $event;
			"
			@select="
				draft = null;
				selected = $event;
			"
		/>
		<PlaceCard v-if="selected" :pin="selected" :styles="categoryStyles" @close="selected = null" />
		<AddPlacePanel
			v-if="draft"
			:point="draft"
			:categories="categories"
			@close="draft = null"
			@saved="onSaved"
		/>
		<ImportPanel
			:state="importState"
			:place-count="importCount"
			:error="importView?.error ?? null"
			@disconnect="disconnect"
		/>
	</div>
</template>
