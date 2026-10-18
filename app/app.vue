<script setup lang="ts">
useHead({
	title: "Aurora",
	meta: [
		{
			name: "description",
			content: "Aurora — a quiet way to remember the places you find.",
		},
	],
});
</script>

<template>
	<UApp>
		<NuxtRouteAnnouncer />
		<NuxtLayout>
			<NuxtPage />
		</NuxtLayout>
	</UApp>
</template>
