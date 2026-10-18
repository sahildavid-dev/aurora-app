<script setup lang="ts">
import type { PlaceRow } from "~/composables/usePlaces";

const PAGE_SIZE = 25;

const {
	places,
	loaded,
	enrichment,
	enrichLeft,
	enrichError,
	enrichNotice,
	enrich,
	loadAndEnrich,
} = usePlaces();
onMounted(() => {
	loadAndEnrich().catch(() => {});
});

const search = ref("");
const category = ref("all");
const country = ref("all");
const status = ref("all");
const location = ref("all");
const page = ref(1);

const categoryItems = computed(() => [
	{ label: "All categories", value: "all" },
	...[...new Set(places.value.map((p) => p.category))]
		.sort((a, b) => a.localeCompare(b))
		.map((c) => ({ label: c, value: c })),
]);
const countryItems = computed(() => [
	{ label: "All countries", value: "all" },
	...[
		...new Set(
			places.value.map((p) => p.country).filter((c): c is string => !!c),
		),
	]
		.sort((a, b) => a.localeCompare(b))
		.map((c) => ({ label: c, value: c })),
]);
const statusItems = [
	{ label: "All statuses", value: "all" },
	{ label: "Confirmed", value: "CONFIRMED" },
	{ label: "Needs review", value: "NEEDS_REVIEW" },
	{ label: "Archived", value: "ARCHIVED" },
];
const locationItems = [
	{ label: "Any location", value: "all" },
	{ label: "On the map", value: "yes" },
	{ label: "No location", value: "no" },
];

const filtered = computed<PlaceRow[]>(() => {
	const q = search.value.trim().toLowerCase();
	return places.value.filter((p) => {
		if (category.value !== "all" && p.category !== category.value) return false;
		if (country.value !== "all" && p.country !== country.value) return false;
		if (status.value !== "all" && p.status !== status.value) return false;
		const hasLocation = p.lat !== null && p.lng !== null;
		if (location.value === "yes" && !hasLocation) return false;
		if (location.value === "no" && hasLocation) return false;
		if (!q) return true;
		return [
			p.name,
			p.address,
			p.city,
			p.region,
			p.country,
			p.category,
			p.notes,
		].some((v) => v?.toLowerCase().includes(q));
	});
});

const rows = computed(() =>
	filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE),
);

// Any filter change goes back to the first page.
watch([search, category, country, status, location], () => {
	page.value = 1;
});

const hasFilters = computed(
	() =>
		search.value !== "" ||
		category.value !== "all" ||
		country.value !== "all" ||
		status.value !== "all" ||
		location.value !== "all",
);
function clearFilters() {
	search.value = "";
	category.value = "all";
	country.value = "all";
	status.value = "all";
	location.value = "all";
}

const STATUS_CLASS: Record<PlaceRow["status"], string> = {
	CONFIRMED: "bg-cotswold-100 text-cotswold-800",
	NEEDS_REVIEW: "bg-amber-50 text-amber-800",
	ARCHIVED: "bg-neutral-100 text-neutral-500",
};

const STATUS_LABEL: Record<PlaceRow["status"], string> = {
	CONFIRMED: "Confirmed",
	NEEDS_REVIEW: "Needs review",
	ARCHIVED: "Archived",
};

const columns = [
	{ accessorKey: "name", header: "Name" },
	{ accessorKey: "city", header: "City" },
	{ accessorKey: "country", header: "Country" },
	{ accessorKey: "category", header: "Category" },
	{ accessorKey: "address", header: "Address" },
	{ accessorKey: "status", header: "Status" },
];
</script>

<template>
	<!-- Borders are softened to a pale sage for this page only; pl-16 / pr-16 keep the header
	     clear of the floating menu (left) and sign-out (right). -->
	<div class="flex h-full flex-col overflow-hidden pl-16 pr-16 [--ui-border:#e6ece2] [--ui-border-accented:#cfdacb]">
		<!-- Top row: lines up with the floating logo and sign-out buttons. -->
		<header class="flex h-[44px] shrink-0 items-center gap-6 mt-3 pl-4">
			<div class="flex items-baseline gap-3">
				<h1 class="text-2xl text-cotswold-950">Places</h1>
				<span class="text-sm text-cotswold-500">{{ places.length }}</span>
			</div>
			<UInput
				v-model="search"
				icon="i-lucide-search"
				placeholder="Search places, cities, notes"
				size="lg"
				variant="soft"
				class="w-full max-w-xl"
				:ui="{ base: '!bg-cotswold-50 hover:!bg-cotswold-100 focus:!bg-white !ring-1 !ring-transparent focus:!ring-cotswold-300 !transition' }"
			/>
		</header>

		<!-- Filters: small, quiet, sitting directly under the search. -->
		<div class="flex shrink-0 flex-wrap items-center gap-1 pb-3 pl-4 pt-3">
			<USelect v-model="country" :items="countryItems" variant="ghost" color="neutral" size="sm" class="w-40" />
			<USelect v-model="category" :items="categoryItems" variant="ghost" color="neutral" size="sm" class="w-40" />
			<USelect v-model="status" :items="statusItems" variant="ghost" color="neutral" size="sm" class="w-36" />
			<USelect v-model="location" :items="locationItems" variant="ghost" color="neutral" size="sm" class="w-36" />
			<UButton v-if="hasFilters" variant="link" color="neutral" size="sm" icon="i-lucide-x" @click="clearFilters">
				Clear
			</UButton>
			<span class="ml-auto pr-2 text-xs text-cotswold-500">
				{{ filtered.length }} shown
				<template v-if="enrichment === 'running'"> · finding locations… {{ enrichLeft }} left</template>
				<template v-else-if="enrichment === 'unavailable'"> · location lookup isn't set up yet</template>
				<template v-else-if="enrichment === 'error'">
					<span :title="enrichError"> · {{ enrichNotice }}</span>
					<button type="button" class="ml-1 underline" @click="enrich">Retry</button>
				</template>
			</span>
		</div>

		<div class="min-h-0 flex-1 overflow-auto pl-4">
			<UTable
				:data="rows"
				:columns="columns"
				:loading="!loaded"
				class="w-full"
				:ui="{
					th: '!text-[11px] !font-medium !uppercase !tracking-[0.14em] !text-cotswold-500 !py-2',
					td: '!py-3.5 !text-sm',
					tr: 'hover:bg-cotswold-50/60 transition-colors',
				}"
			>
				<template #name-cell="{ row }">
					<span class="font-semibold text-cotswold-950">{{ row.original.name }}</span>
				</template>
				<template #city-cell="{ row }">
					<span>{{ row.original.city ?? "—" }}</span>
				</template>
				<template #country-cell="{ row }">
					<span class="text-cotswold-700">{{ row.original.country ?? "—" }}</span>
				</template>
				<template #category-cell="{ row }">
					<span class="text-cotswold-600">{{ row.original.category }}</span>
				</template>
				<template #address-cell="{ row }">
					<span class="block max-w-[28rem] truncate text-cotswold-500">{{ row.original.address ?? "—" }}</span>
				</template>
				<template #status-cell="{ row }">
					<span
						class="inline-block rounded-[4px] px-2 py-0.5 text-xs font-medium"
						:class="STATUS_CLASS[row.original.status]"
					>
						{{ STATUS_LABEL[row.original.status] }}
					</span>
				</template>
				<template #empty>
					<p class="py-16 text-center text-sm text-cotswold-500">
						{{ loaded ? "No places match." : "Loading…" }}
					</p>
				</template>
			</UTable>
		</div>

		<footer class="flex shrink-0 justify-end py-3 pl-4">
			<UPagination
				v-model:page="page"
				:items-per-page="PAGE_SIZE"
				:total="filtered.length"
				variant="ghost"
				color="neutral"
				active-variant="soft"
				active-color="neutral"
				size="sm"
			/>
		</footer>
	</div>
</template>
