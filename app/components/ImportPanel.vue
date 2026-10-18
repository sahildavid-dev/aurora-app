<script setup lang="ts">
const props = defineProps<{
	state: "idle" | "PENDING" | "IMPORTING" | "COMPLETE" | "FAILED";
	placeCount: number;
	error: string | null;
}>();
const emit = defineEmits<{ disconnect: [] }>();

const busy = computed(
	() => props.state === "PENDING" || props.state === "IMPORTING",
);
const connected = computed(() => props.state === "COMPLETE");
const label = computed(() => {
	if (busy.value) return "Importing…";
	if (connected.value) return `Google connected · ${props.placeCount}`;
	if (props.state === "FAILED") return "Import failed · Retry";
	return "Connect Google";
});
const icon = computed(() => {
	if (busy.value) return "i-lucide-loader-circle";
	if (connected.value) return "i-lucide-check";
	if (props.state === "FAILED") return "i-lucide-triangle-alert";
	return "i-lucide-link";
});

const menu = computed(() => [
	{
		label: "Import again",
		icon: "i-lucide-refresh-cw",
		onSelect: () => navigateTo("/api/google/connect", { external: true }),
	},
	{
		label: "Disconnect",
		icon: "i-lucide-unplug",
		onSelect: () => emit("disconnect"),
	},
]);

// Quiet glass pill, top-right, just left of the sign-out button.
const pill =
	"absolute right-16 top-3 z-10 flex h-11 items-center gap-2 rounded-[8px] border border-white/60 bg-white/55 px-3 text-xs font-medium text-black/60 shadow-[0_4px_24px_rgba(0,0,0,0.10)] backdrop-blur-md transition";
</script>

<template>
	<!-- Connected: the pill opens a small menu (import again / disconnect). Running: inert
	     spinner. Otherwise it is a plain link that starts the Google consent flow. -->
	<UDropdownMenu v-if="connected" :items="menu" :content="{ align: 'end' }">
		<button type="button" :class="[pill, 'hover:bg-white/80 hover:text-black']" title="Google Maps is connected">
			<UIcon :name="icon" class="size-4" />
			<span>{{ label }}</span>
			<UIcon name="i-lucide-chevron-down" class="size-3.5" />
		</button>
	</UDropdownMenu>
	<div v-else-if="busy" :class="[pill, 'cursor-default']" title="Importing your saved places from Google Maps">
		<UIcon :name="icon" class="size-4 animate-spin" />
		<span>{{ label }}</span>
	</div>
	<a v-else href="/api/google/connect" :class="[pill, 'hover:bg-white/80 hover:text-black']" :title="error ?? 'Import saved places from Google Maps'">
		<UIcon :name="icon" class="size-4" />
		<span>{{ label }}</span>
	</a>
</template>
