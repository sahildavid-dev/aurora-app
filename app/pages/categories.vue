<script setup lang="ts">
import type { CategoryItem } from "~/composables/useCategoryStyles";

const { items, loaded, load } = useCategoryStyles();
onMounted(() => {
	load().catch(() => {});
});

const search = ref("");
const visible = computed(() => {
	const q = search.value.trim().toLowerCase();
	return q
		? items.value.filter((c) => c.name.toLowerCase().includes(q))
		: items.value;
});

// Effective look of a category: the vendor's choice, else the built-in default.
function look(c: CategoryItem) {
	return c.icon && c.color
		? { icon: c.icon, color: c.color }
		: defaultCategoryStyle(c.name);
}

// Readable text on a label colour.
function textOn(hex: string): string {
	const n = Number.parseInt(hex.slice(1), 16);
	const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
	return lum > 150 ? "#1c1c1a" : "#ffffff";
}

// --- Editor ---------------------------------------------------------------
const selected = ref<CategoryItem | null>(null);
const draftIcon = ref("map-pin");
const draftColor = ref("#3c4c3f");
const hexInput = ref("#3c4c3f");
const iconSearch = ref("");
const saving = ref(false);
const error = ref("");

const PRESETS = [
	"#d73a4a",
	"#e0566f",
	"#e99695",
	"#b60205",
	"#e8a317",
	"#fbca04",
	"#e4e669",
	"#0e8a16",
	"#2e8b57",
	"#7a9479",
	"#3c4c3f",
	"#006b75",
	"#a2eeef",
	"#3b82a0",
	"#1d76db",
	"#0052cc",
	"#5319e7",
	"#7057ff",
	"#d876e3",
	"#bfdadc",
	"#c5def5",
	"#f9d0c4",
	"#8b6f47",
	"#6b7280",
];

function select(c: CategoryItem) {
	selected.value = c;
	const l = look(c);
	draftIcon.value = l.icon;
	draftColor.value = l.color;
	hexInput.value = l.color;
	iconSearch.value = "";
	error.value = "";
	loadIcons();
}

function setColor(hex: string) {
	draftColor.value = hex.toLowerCase();
	hexInput.value = draftColor.value;
}
function onHexInput() {
	const v = hexInput.value.startsWith("#")
		? hexInput.value
		: `#${hexInput.value}`;
	if (/^#[0-9a-f]{6}$/i.test(v)) draftColor.value = v.toLowerCase();
}

// Icon names, loaded once when the editor first opens, then filtered locally.
const allIcons = ref<string[]>([]);
async function loadIcons() {
	if (allIcons.value.length > 0) return;
	try {
		allIcons.value = (await $fetch<{ icons: string[] }>("/api/icons")).icons;
	} catch {
		allIcons.value = [];
	}
}
const ICON_LIMIT = 112;
const matchingIcons = computed(() => {
	const q = iconSearch.value.trim().toLowerCase().replace(/\s+/g, "-");
	const list = q ? allIcons.value.filter((n) => n.includes(q)) : allIcons.value;
	return list.slice(0, ICON_LIMIT);
});

const dirty = computed(() => {
	if (!selected.value) return false;
	const l = look(selected.value);
	return l.icon !== draftIcon.value || l.color !== draftColor.value;
});

async function save() {
	if (!selected.value) return;
	saving.value = true;
	error.value = "";
	try {
		await $fetch("/api/categories", {
			method: "PUT",
			body: {
				name: selected.value.name,
				icon: draftIcon.value,
				color: draftColor.value,
			},
		});
		await load();
		selected.value =
			items.value.find((c) => c.name === selected.value?.name) ?? null;
	} catch (e) {
		error.value =
			(e as { data?: { statusMessage?: string } })?.data?.statusMessage ??
			"Could not save";
	} finally {
		saving.value = false;
	}
}

async function reset() {
	if (!selected.value) return;
	saving.value = true;
	try {
		await $fetch("/api/categories", {
			method: "DELETE",
			query: { name: selected.value.name },
		});
		await load();
		const again =
			items.value.find((c) => c.name === selected.value?.name) ?? null;
		if (again) select(again);
	} finally {
		saving.value = false;
	}
}
</script>

<template>
	<div class="flex h-full flex-col overflow-hidden pl-16 pr-16 [--ui-border:#e6ece2] [--ui-border-accented:#cfdacb]">
		<header class="mt-3 flex h-[44px] shrink-0 items-center gap-6 pl-4">
			<div class="flex items-baseline gap-3">
				<h1 class="text-2xl text-cotswold-950">Categories</h1>
				<span class="text-sm text-cotswold-500">{{ items.length }}</span>
			</div>
			<UInput
				v-model="search"
				icon="i-lucide-search"
				placeholder="Search categories"
				size="lg"
				variant="soft"
				class="w-full max-w-md"
				:ui="{ base: '!bg-cotswold-50 hover:!bg-cotswold-100 focus:!bg-white !ring-1 !ring-transparent focus:!ring-cotswold-300 !transition' }"
			/>
		</header>
		<p class="shrink-0 pb-3 pl-4 pt-3 text-xs text-cotswold-500">
			Pick an icon and colour for each category. They are used for the pins on the map.
		</p>

		<div class="grid min-h-0 flex-1 gap-8 pl-4 lg:grid-cols-[1fr_380px]">
			<!-- Category list -->
			<div class="min-h-0 overflow-auto pb-6">
				<p v-if="loaded && visible.length === 0" class="py-16 text-center text-sm text-cotswold-500">No categories match.</p>
				<ul class="divide-y divide-default">
					<li v-for="c in visible" :key="c.name">
						<button
							type="button"
							class="flex w-full items-center gap-4 px-2 py-3 text-left transition-colors hover:bg-cotswold-50/60"
							:class="selected?.name === c.name && 'bg-cotswold-50'"
							@click="select(c)"
						>
							<span
								class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium"
								:style="{ backgroundColor: look(c).color, color: textOn(look(c).color) }"
							>
								<UIcon :name="`i-lucide-${look(c).icon}`" class="size-4" />
								{{ c.name }}
							</span>
							<span v-if="c.icon" class="text-xs text-cotswold-500">customised</span>
							<span class="ml-auto text-sm text-cotswold-600">{{ c.count }} {{ c.count === 1 ? "place" : "places" }}</span>
						</button>
					</li>
				</ul>
			</div>

			<!-- Editor -->
			<aside class="min-h-0 overflow-auto pb-6">
				<div v-if="!selected" class="rounded-[8px] bg-cotswold-50 p-6 text-sm text-cotswold-600">
					Select a category to choose its icon and colour.
				</div>
				<div v-else class="space-y-6 rounded-[8px] border border-default p-5">
					<div class="flex items-center justify-between gap-3">
						<h2 class="truncate text-lg text-cotswold-950">{{ selected.name }}</h2>
						<!-- How it will look on the map -->
						<span
							class="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-white shadow"
							:style="{ backgroundColor: draftColor, color: textOn(draftColor) }"
							title="Map pin preview"
						>
							<UIcon :name="`i-lucide-${draftIcon}`" class="size-4" />
						</span>
					</div>

					<!-- Colour -->
					<div class="space-y-2">
						<p class="text-[11px] font-medium uppercase tracking-[0.14em] text-cotswold-500">Colour</p>
						<div class="flex flex-wrap gap-1.5">
							<button
								v-for="hex in PRESETS"
								:key="hex"
								type="button"
								class="size-6 rounded-full border border-black/10 transition hover:scale-110"
								:class="draftColor === hex && 'ring-2 ring-cotswold-900 ring-offset-2'"
								:style="{ backgroundColor: hex }"
								:aria-label="hex"
								@click="setColor(hex)"
							/>
						</div>
						<div class="flex items-center gap-2">
							<input
								type="color"
								:value="draftColor"
								class="size-8 cursor-pointer rounded-[4px] border border-default bg-transparent p-0.5"
								aria-label="Pick a colour"
								@input="setColor(($event.target as HTMLInputElement).value)"
							/>
							<UInput v-model="hexInput" size="sm" class="w-28" placeholder="#3c4c3f" @update:model-value="onHexInput" />
						</div>
					</div>

					<!-- Icon -->
					<div class="space-y-2">
						<p class="text-[11px] font-medium uppercase tracking-[0.14em] text-cotswold-500">Icon</p>
						<UInput v-model="iconSearch" icon="i-lucide-search" size="sm" placeholder="Search icons (heart, coffee, plane…)" class="w-full" />
						<div class="grid max-h-64 grid-cols-7 gap-1 overflow-auto">
							<button
								v-for="name in matchingIcons"
								:key="name"
								type="button"
								class="flex aspect-square items-center justify-center rounded-[6px] text-cotswold-700 transition hover:bg-cotswold-100"
								:class="draftIcon === name && '!bg-cotswold-900 !text-white'"
								:title="name"
								@click="draftIcon = name"
							>
								<UIcon :name="`i-lucide-${name}`" class="size-5" />
							</button>
						</div>
						<p v-if="allIcons.length && matchingIcons.length === 0" class="text-xs text-cotswold-500">No icons match.</p>
						<p v-else-if="iconSearch === '' && allIcons.length > ICON_LIMIT" class="text-xs text-cotswold-500">
							Showing {{ ICON_LIMIT }} of {{ allIcons.length }}. Search to find more.
						</p>
					</div>

					<p v-if="error" class="text-xs text-red-700" role="alert">{{ error }}</p>
					<div class="flex items-center justify-between gap-2">
						<UButton v-if="selected.icon" variant="link" color="neutral" size="sm" :disabled="saving" @click="reset">
							Reset to default
						</UButton>
						<span v-else />
						<UButton size="sm" :loading="saving" :disabled="!dirty" class="!bg-cotswold-700 !text-white hover:!bg-cotswold-800" @click="save">
							Save
						</UButton>
					</div>
				</div>
			</aside>
		</div>
	</div>
</template>
