<script setup lang="ts">
const props = defineProps<{
	point: { lat: number; lng: number };
	categories: string[];
}>();
const emit = defineEmits<{ close: []; saved: [] }>();

interface Location {
	formattedAddress: string | null;
	city: string | null;
	region: string | null;
	country: string | null;
	countryCode: string | null;
}

const name = ref("");
const list = ref("Starred");
const notes = ref("");
const location = ref<Location | null>(null);
const lookingUp = ref(true);
const saving = ref(false);
const error = ref("");

const BASE_LISTS = ["Starred", "Favourite places", "Want to go"];
const lists = ref<string[]>([]);
watchEffect(() => {
	lists.value = [...new Set([...BASE_LISTS, ...props.categories])];
});

// Look up the clicked point; a failure just means the panel shows coordinates only.
watch(
	() => props.point,
	async (p) => {
		lookingUp.value = true;
		location.value = null;
		try {
			const res = await $fetch<{ location: Location | null }>(
				"/api/geocode/reverse",
				{
					query: { lat: p.lat, lng: p.lng },
				},
			);
			location.value = res.location;
		} catch {
			location.value = null;
		} finally {
			lookingUp.value = false;
		}
	},
	{ immediate: true },
);

const place = computed(() =>
	[location.value?.city, location.value?.region, location.value?.country]
		.filter(Boolean)
		.join(", "),
);
// Once a name is typed, search for the place by name and address (opens the place page);
// before that, the exact point.
const mapsUrl = computed(() =>
	googleMapsUrl({
		name: name.value.trim(),
		address: location.value?.formattedAddress,
		lat: props.point.lat,
		lng: props.point.lng,
	}),
);

function addList(item: string) {
	lists.value = [...lists.value, item];
	list.value = item;
}

async function save() {
	if (!name.value.trim()) return;
	saving.value = true;
	error.value = "";
	try {
		await $fetch("/api/places", {
			method: "POST",
			body: {
				name: name.value.trim(),
				category: list.value,
				lat: props.point.lat,
				lng: props.point.lng,
				address: location.value?.formattedAddress ?? null,
				city: location.value?.city ?? null,
				region: location.value?.region ?? null,
				country: location.value?.country ?? null,
				countryCode: location.value?.countryCode ?? null,
				notes: notes.value.trim() || null,
			},
		});
		emit("saved");
	} catch (e) {
		error.value =
			(e as { data?: { statusMessage?: string } })?.data?.statusMessage ??
			"Could not save the place";
	} finally {
		saving.value = false;
	}
}

const fieldUi = {
	root: "w-full",
	base: "!bg-cotswold-50 !text-cotswold-950 placeholder:!text-cotswold-500 !ring-1 !ring-cotswold-200 focus:!ring-2 focus:!ring-cotswold-600 !transition",
};
</script>

<template>
	<section
		class="absolute right-3 top-[68px] z-10 w-80 rounded-[8px] border border-white/60 bg-white/90 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.16)] backdrop-blur-md"
		@keydown.esc="emit('close')"
	>
		<div class="flex items-start justify-between gap-2">
			<div>
				<h2 class="text-lg text-cotswold-950">Add a place</h2>
				<p class="mt-0.5 min-h-4 text-xs text-cotswold-600">
					<template v-if="lookingUp">Finding the address…</template>
					<template v-else-if="location?.formattedAddress">{{ location.formattedAddress }}</template>
					<template v-else>{{ point.lat.toFixed(5) }}, {{ point.lng.toFixed(5) }}</template>
				</p>
				<p v-if="place" class="text-xs text-cotswold-500">{{ place }}</p>
			</div>
			<UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" square aria-label="Close" @click="emit('close')" />
		</div>

		<form class="mt-4 space-y-3" @submit.prevent="save">
			<UInput v-model="name" placeholder="Name" autofocus required :ui="fieldUi" />
			<USelectMenu
				v-model="list"
				:items="lists"
				create-item
				placeholder="List"
				:ui="{ base: '!bg-cotswold-50 !ring-1 !ring-cotswold-200' }"
				class="w-full"
				@create="addList"
			/>
			<UTextarea v-model="notes" placeholder="Notes (optional)" :rows="2" :ui="fieldUi" />
			<p v-if="error" class="text-xs text-red-700" role="alert">{{ error }}</p>
			<div class="flex items-center justify-between gap-2">
				<a :href="mapsUrl" target="_blank" rel="noopener" class="text-xs text-cotswold-600 underline hover:text-cotswold-900">
					Open in Google Maps
				</a>
				<UButton type="submit" size="sm" :loading="saving" :disabled="!name.trim()" class="!bg-cotswold-700 !text-white hover:!bg-cotswold-800">
					Save place
				</UButton>
			</div>
		</form>
	</section>
</template>
