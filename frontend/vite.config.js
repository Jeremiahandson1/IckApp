import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'splash/*.png'],
      manifest: {
        name: 'Ick',
        short_name: 'Ick',
        description: 'Scan food. See the junk. Swap it.',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Force old service workers to update immediately
        skipWaiting: true,
        clientsClaim: true,
        // Clean up stale caches from old service worker versions
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Never cache scan/score/search responses — these change as the
            // scoring engine improves. Stale cached scores were causing
            // audits to see old data after fixes had shipped.
            urlPattern: ({ url }) => url.pathname.match(/^\/api\/(products\/scan|products\/search|swaps|pantry|progress|receipts)/),
            handler: 'NetworkOnly',
          },
          {
            // Other /api/ routes (companies list, recipes, static lookups)
            // can be NetworkFirst with a short TTL.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache-v3',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 // 1 hour (was 24h)
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          // Stable vendor chunk — changes rarely, so it stays cached across
          // app deploys.
          'react-vendor': ['react', 'react-dom', 'react-router-dom']
        }
      }
    }
  }
});
