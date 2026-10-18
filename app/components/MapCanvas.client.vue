<script setup lang="ts">
import type { CategoryStyleView } from "~/utils/placeIcons";

export interface MapPin {
	id: string;
	name: string;
	lat: number;
	lng: number;
	address: string | null;
	category: string;
	/** The place's own Google Maps page, when we have it. */
	sourceUrl: string | null;
}

const props = defineProps<{
	pins: MapPin[];
	/** Vendor-chosen icon + colour per category; missing ones use the defaults. */
	styles?: Record<string, CategoryStyleView>;
	/** A point the user clicked, shown as a draft pin while the add-place panel is open. */
	draft: { lat: number; lng: number } | null;
}>();
const emit = defineEmits<{
	pick: [point: { lat: number; lng: number }];
	select: [pin: MapPin];
}>();

const el = useTemplateRef<HTMLDivElement>("el");
const error = ref("");

let map: google.maps.Map | undefined;
let markers: google.maps.Marker[] = [];
let draftMarker: google.maps.Marker | undefined;

// Soft Cotswold-green base map: pale land, sage parks, muted water, quiet labels.
const MAP_STYLES: google.maps.MapTypeStyle[] = [
	{ elementType: "geometry", stylers: [{ color: "#eef1ea" }] },
	{ elementType: "labels.icon", stylers: [{ visibility: "off" }] },
	{ elementType: "labels.text.fill", stylers: [{ color: "#5f7860" }] },
	{ elementType: "labels.text.stroke", stylers: [{ color: "#f3f6f1" }] },
	{
		featureType: "administrative",
		elementType: "geometry.stroke",
		stylers: [{ color: "#cfdacb" }],
	},
	{
		featureType: "administrative.land_parcel",
		stylers: [{ visibility: "off" }],
	},
	{
		featureType: "landscape.natural",
		elementType: "geometry",
		stylers: [{ color: "#e4eadf" }],
	},
	{ featureType: "poi", stylers: [{ visibility: "off" }] },
	{
		featureType: "poi.park",
		elementType: "geometry",
		stylers: [{ visibility: "on" }, { color: "#d3dfcd" }],
	},
	{
		featureType: "road",
		elementType: "geometry",
		stylers: [{ color: "#ffffff" }],
	},
	{
		featureType: "road",
		elementType: "geometry.stroke",
		stylers: [{ color: "#e1e8dc" }],
	},
	{
		featureType: "road",
		elementType: "labels.text.fill",
		stylers: [{ color: "#94ab92" }],
	},
	{
		featureType: "road.highway",
		elementType: "geometry",
		stylers: [{ color: "#f8faf5" }],
	},
	{ featureType: "transit", stylers: [{ visibility: "off" }] },
	{
		featureType: "water",
		elementType: "geometry",
		stylers: [{ color: "#c6d5ca" }],
	},
	{
		featureType: "water",
		elementType: "labels.text.fill",
		stylers: [{ color: "#7a9479" }],
	},
];

const PIN_GREEN = "#3c4c3f";

function drawDraft() {
	if (!map) return;
	draftMarker?.setMap(null);
	draftMarker = undefined;
	if (!props.draft) return;
	draftMarker = new google.maps.Marker({
		map,
		position: props.draft,
		zIndex: 2000,
		icon: {
			path: google.maps.SymbolPath.CIRCLE,
			scale: 9,
			fillColor: "#dfe98e",
			fillOpacity: 1,
			strokeColor: "#3c4c3f",
			strokeWeight: 3,
		},
	});
}

function draw() {
	if (!map) return;
	const maps = google.maps;
	for (const m of markers) m.setMap(null);
	markers = props.pins.map((pin) => {
		const marker = new maps.Marker({
			map,
			position: { lat: pin.lat, lng: pin.lng },
			title: pin.name,
			icon: {
				url: placeMarkerUrl(pin.category, props.styles),
				scaledSize: new maps.Size(34, 34),
				anchor: new maps.Point(17, 17),
			},
		});
		marker.addListener("click", () => {
			map?.panTo({ lat: pin.lat, lng: pin.lng });
			emit("select", pin);
		});
		return marker;
	});

	if (props.pins.length > 0) {
		const bounds = new maps.LatLngBounds();
		for (const pin of props.pins) bounds.extend({ lat: pin.lat, lng: pin.lng });
		map.fitBounds(bounds, 80);
	}
}

onMounted(async () => {
	try {
		const maps = await useGoogleMaps();
		if (!el.value) return;
		map = new maps.Map(el.value, {
			center: { lat: 20, lng: 0 },
			zoom: 3,
			styles: MAP_STYLES,
			disableDefaultUI: true,
			zoomControl: true,
			gestureHandling: "greedy",
		});
		map.addListener("click", (e: google.maps.MapMouseEvent) => {
			if (!e.latLng) return;
			emit("pick", { lat: e.latLng.lat(), lng: e.latLng.lng() });
		});
		draw();
	} catch (e) {
		error.value = e instanceof Error ? e.message : "Map failed to load";
	}
});

watch(() => props.pins, draw);
watch(() => props.styles, draw);
watch(() => props.draft, drawDraft);
</script>

<template>
	<div class="relative size-full">
		<div ref="el" class="size-full" />
		<p v-if="error" class="absolute inset-0 flex items-center justify-center text-sm" role="alert">
			{{ error }}
		</p>
	</div>
</template>
