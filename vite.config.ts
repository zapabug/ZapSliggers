import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'

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
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'icons/spaceship_small_blue.png',
        'icons/spaceship_small_red.png',
        'icons/backdrop.png',
        'icons/icon-192.png',
        'icons/icon-512.png'
      ],
      manifest: {
        name: 'ZapSliggers',
        short_name: 'ZapSliggers',
        description: 'A 2D Nostr space artillery game with eCash wagering.',
        theme_color: '#111827', // Approx bg-gray-900
        background_color: '#111827', // Approx bg-gray-900
        display: 'fullscreen', // Request fullscreen display
        orientation: 'landscape', // Request landscape orientation
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png', // Updated to match actual filename
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-512.png', // Updated to match actual filename
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    }),
    basicSsl()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
  // base: '/ZapSliggers/' // Removed for local development
})
