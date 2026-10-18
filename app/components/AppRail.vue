<script setup lang="ts">
const route = useRoute();

const items = [
	{ to: "/", icon: "i-lucide-map", label: "Map" },
	{ to: "/places", icon: "i-lucide-list", label: "Places" },
	{ to: "/categories", icon: "i-lucide-tags", label: "Categories" },
];

async function signOut() {
	await $fetch("/api/auth/logout", { method: "POST" });
	await navigateTo("/login");
}

// White glass floating over the map; a little rounder than the app-wide 4px on purpose.
const glass =
	"absolute z-10 rounded-[8px] border border-white/60 bg-white/55 shadow-[0_4px_24px_rgba(0,0,0,0.10)] backdrop-blur-md";
// Small, quiet icon buttons: muted until hovered or active.
const iconButton =
	"!rounded-[6px] !text-black/55 hover:!bg-white/70 hover:!text-black";
const activeButton = "!bg-white !text-black !shadow-sm";
</script>

<template>
	<!-- Everything floats over the page: logo + menu in one card top-left, sign out top-right.
	     The logo is a square tile the same size as the menu buttons. -->
	<nav :class="[glass, 'left-3 top-3 flex w-11 flex-col items-center gap-1 p-1.5']">
		<!-- The PNG is a glyph on a padded white square: scaled up to fill the tile, and
		     multiplied so its white background lets the glass show through. -->
		<NuxtLink to="/" aria-label="Aurora" class="mb-2 block size-8 shrink-0 overflow-hidden rounded-[6px]">
			<img src="/aurora-logo.png" alt="Aurora" class="size-full scale-[1.45] object-cover mix-blend-multiply" />
		</NuxtLink>
		<UTooltip v-for="item in items" :key="item.to" :text="item.label" :content="{ side: 'right' }">
			<UButton
				:to="item.to"
				:icon="item.icon"
				color="neutral"
				variant="ghost"
				square
				size="sm"
				:aria-label="item.label"
				:class="[iconButton, route.path === item.to && activeButton]"
			/>
		</UTooltip>
	</nav>

	<div :class="[glass, 'right-3 top-3 flex size-11 items-center justify-center']">
		<UTooltip text="Sign out" :content="{ side: 'left' }">
			<UButton
				icon="i-lucide-log-out"
				color="neutral"
				variant="ghost"
				square
				size="sm"
				aria-label="Sign out"
				:class="iconButton"
				@click="signOut"
			/>
		</UTooltip>
	</div>
</template>
