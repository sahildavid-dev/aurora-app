<script setup lang="ts">
import type { MapPin } from "~/components/MapCanvas.client.vue";
import type { CategoryStyleView } from "~/utils/placeIcons";

const props = defineProps<{
	pin: MapPin;
	styles?: Record<string, CategoryStyleView>;
}>();
const emit = defineEmits<{ close: [] }>();

const icon = computed(() => placeMarkerUrl(props.pin.category, props.styles));
const url = computed(() => googleMapsUrl(props.pin));
</script>

<template>
	<!-- The selected pin's details, floating at the bottom of the map. -->
	<section
		class="absolute bottom-6 left-1/2 z-10 w-[min(26rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-[10px] border border-white/60 bg-white/92 p-5 shadow-[0_10px_40px_rgba(20,28,23,0.2)] backdrop-blur-md"
		aria-live="polite"
	>
		<UButton
			icon="i-lucide-x"
			color="neutral"
			variant="ghost"
			size="xs"
			square
			class="absolute right-2 top-2 !text-cotswold-500"
			aria-label="Close"
			@click="emit('close')"
		/>

		<div class="flex items-center gap-2">
			<img :src="icon" alt="" class="size-7 shrink-0" />
			<span class="text-[11px] font-semibold uppercase tracking-[0.14em] text-cotswold-600">{{ pin.category }}</span>
		</div>
		<h3 class="mt-2 pr-6 text-xl font-semibold leading-snug text-cotswold-950">{{ pin.name }}</h3>
		<p v-if="pin.address" class="mt-1 text-sm leading-relaxed text-cotswold-600">{{ pin.address }}</p>

		<a
			:href="url"
			target="_blank"
			rel="noopener"
			class="mt-4 inline-flex items-center gap-1.5 rounded-[6px] bg-cotswold-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-cotswold-800"
		>
			Open in Google Maps
			<UIcon name="i-lucide-arrow-up-right" class="size-4" />
		</a>
	</section>
</template>
