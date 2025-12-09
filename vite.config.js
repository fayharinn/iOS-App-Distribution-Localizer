import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Set VITE_BASE_PATH=/xcstrings-localizer/ for GitHub Pages, otherwise defaults to /
  base: process.env.VITE_BASE_PATH || '/',
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    proxy: {
      '/api/appstoreconnect': {
        target: 'https://api.appstoreconnect.apple.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/appstoreconnect/, ''),
        secure: true,
      },
    },
  },
})
