import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    // amazon-cognito-identity-js uses Node.js `global` internally.
    // Vite builds for the browser, where `global` doesn't exist.
    // This tells Vite to replace references to `global` with `globalThis`
    // (the browser-standard equivalent) at build time.
    global: "globalThis",
  },
})
