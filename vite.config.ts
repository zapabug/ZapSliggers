import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({ 
      registerType: 'autoUpdate', // Automatically update the service worker
      injectRegister: 'auto', // Let the plugin handle registration script injection
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff,woff2}'], // Files to cache
        // runtimeCaching: [...] // Optional: Add runtime caching strategies if needed
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'], // Ensure icons are cached
      manifest: {
        name: 'Klunkstr',
        short_name: 'Klunkstr',
        description: 'A 2D Nostr space artillery game with eCash wagering.',
        theme_color: '#111827', // Approx bg-gray-900
        background_color: '#111827', // Approx bg-gray-900
        display: 'fullscreen', // Request fullscreen display
        orientation: 'landscape', // Request landscape orientation
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192x192.png', // Path relative to public folder
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable' // Common purpose setting
          },
          {
            src: '/icons/icon-512x512.png', // Path relative to public folder
            sizes: '512x512',
            type: 'image/png'
          }
          // Add more icon sizes if needed (e.g., 144x144, 256x256, etc.)
        ]
      }
    }),
    basicSsl()
  ],
})
