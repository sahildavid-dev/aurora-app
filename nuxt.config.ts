// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: "2025-07-15",
	devtools: { enabled: true },
	modules: ["@nuxt/ui"],
	css: ["~/assets/css/main.css"],
	// Black and white only for now — no theme yet. Light by default.
	colorMode: {
		preference: "light",
		fallback: "light",
	},

	// Server-only secrets — never exposed to the client bundle (nothing here
	// is under `public`). Defaults are read from `process.env` right here,
	// which Nitro evaluates at BUILD time, then baked into the server
	// bundle. That's deliberate: on Amplify's Lambda-backed SSR compute,
	// console-configured env vars aren't reliably present in the Lambda's
	// runtime environment, but they are present during `nuxt build`. Reading
	// `process.env` directly in a route handler (evaluated per-request, at
	// runtime) is what was failing; reading it here bakes the value in once,
	// at a point where it's actually available. (Nitro will still let a
	// matching `NUXT_*`-prefixed env var override a given key at runtime,
	// per Nuxt's usual convention — see https://nuxt.com/docs/guide/going-further/runtime-config
	// — but nothing here depends on that.)
	runtimeConfig: {
		// Browser key for the Maps JavaScript API — public by nature (it ships to the client),
		// so restrict it by HTTP referrer in Google Cloud.
		public: { googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? "" },
		// Server-side key for the Geocoding API (city / country lookup). Not the browser Maps key.
		googleGeocodingApiKey: process.env.GOOGLE_GEOCODING_API_KEY ?? "",
		googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
		googleRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? "",
		googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
		// Encrypts Google access tokens stored in the database (server/utils/secretBox.ts).
		secretEncryptionKey: process.env.SECRET_ENCRYPTION_KEY ?? "",
		databaseUrl: process.env.DATABASE_URL ?? "",
		publicUrl: process.env.PUBLIC_URL ?? "",
		twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
		twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? "",
		twilioWhatsappFrom: process.env.TWILIO_WHATSAPP_FROM ?? "",
		triggerSecretKey: process.env.TRIGGER_SECRET_KEY ?? "",
		internalApiSecret: process.env.INTERNAL_API_SECRET ?? "",
	},

	// Allow the Vite dev server to accept requests coming through an ngrok
	// tunnel (used to expose the Twilio webhook while developing locally).
	// Dev-only — the production build doesn't run the Vite dev server.
	vite: {
		server: {
			allowedHosts: [".ngrok-free.app", ".ngrok.io", ".ngrok.app"],
		},
	},
});
