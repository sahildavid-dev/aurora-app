<script setup lang="ts">
definePageMeta({ layout: false });

const state = reactive({ email: "", password: "" });
const error = ref("");
const pending = ref(false);
const showPassword = ref(false);
function togglePassword() {
	showPassword.value = !showPassword.value;
}

async function submit() {
	error.value = "";
	pending.value = true;
	try {
		await $fetch("/api/auth/login", { method: "POST", body: state });
		await navigateTo("/");
	} catch (e) {
		error.value =
			(e as { data?: { statusMessage?: string } })?.data?.statusMessage ??
			"Something went wrong";
	} finally {
		pending.value = false;
	}
}

const fieldUi = {
	root: "w-full",
	base: "!bg-cotswold-50 !text-cotswold-950 placeholder:!text-cotswold-500 !ring-1 !ring-cotswold-200 hover:!ring-cotswold-300 focus:!ring-2 focus:!ring-cotswold-600 !rounded-[4px] !py-3 !px-4 !transition",
};
const labelUi = {
	label:
		"!text-xs !uppercase !tracking-[0.16em] !text-cotswold-600 !font-medium",
};
</script>

<template>
	<div class="grid min-h-dvh lg:grid-cols-2">
		<!-- Image panel. Photo: public/images/es-vedra.jpg; deep Cotswold green shows until it loads. -->
		<div
			class="relative hidden flex-col justify-between bg-cotswold-900 bg-cover bg-center p-12 text-white lg:flex"
			style="background-image: url('/images/es-vedra.jpg')"
		>
			<div aria-hidden="true" class="absolute inset-0 bg-gradient-to-t from-cotswold-950/70 via-transparent to-cotswold-950/30" />
			<span class="relative text-sm uppercase tracking-[0.3em]">Aurora</span>
			<h1 class="relative max-w-md text-5xl leading-tight text-white">
				A quiet way to remember the places you find.
			</h1>
		</div>

		<!-- Form -->
		<div class="flex items-center justify-center bg-white p-8">
			<form class="w-full max-w-sm space-y-7" @submit.prevent="submit">
				<div class="space-y-2">
					<h2 class="text-3xl font-medium text-cotswold-950">Sign in</h2>
					<p class="text-sm text-cotswold-600">Welcome back. Pick up where you left off.</p>
				</div>

				<div class="space-y-5">
					<UFormField label="Email" :ui="labelUi">
						<UInput v-model="state.email" type="email" autocomplete="username" required :ui="fieldUi" />
					</UFormField>
					<UFormField label="Password" :ui="labelUi">
						<UInput
							v-model="state.password"
							:type="showPassword ? 'text' : 'password'"
							autocomplete="current-password"
							required
							autofocus
							:ui="fieldUi"
						>
							<template #trailing>
								<UButton
									:icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
									color="neutral"
									variant="link"
									size="sm"
									:aria-label="showPassword ? 'Hide password' : 'Show password'"
									class="!text-cotswold-500"
									@click="togglePassword"
								/>
							</template>
						</UInput>
					</UFormField>
				</div>

				<p v-if="error" class="rounded-[4px] bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
					{{ error }}
				</p>

				<UButton
					type="submit"
					block
					size="xl"
					:loading="pending"
					class="!rounded-[4px] !bg-cotswold-700 !font-semibold !text-white transition hover:!bg-cotswold-800 focus-visible:!outline-cotswold-700"
				>
					Sign in
				</UButton>
			</form>
		</div>
	</div>
</template>
