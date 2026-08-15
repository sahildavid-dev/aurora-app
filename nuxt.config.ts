// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // Allow the Vite dev server to accept requests coming through an ngrok
  // tunnel (used to expose the Twilio webhook while developing locally).
  // Dev-only — the production build doesn't run the Vite dev server.
  vite: {
    server: {
      allowedHosts: ['.ngrok-free.app', '.ngrok.io', '.ngrok.app']
    }
  }
})
