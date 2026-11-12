import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: [],
          includeManifestIcons: false,
          workbox: {
            cleanupOutdatedCaches: true,
            skipWaiting: true,
            clientsClaim: true,
            maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,ttf}'],
            globIgnores: ['**/assets/aistudio/**', '**/google*.html', '**/yandex*.html', '**/sw.js', '**/workbox-*.js'],
            navigateFallbackDenylist: [/^\/api\//, /^\/__\//, /google.*\.html$/, /yandex.*\.html$/, /robots\.txt$/, /sitemap\.xml$/],
          },
          manifest: {
            id: './',
            name: 'E-Journal Pro',
            short_name: 'E-Journal',
            description: 'Электронный журнал и дневник образовательного учреждения',
            theme_color: '#ffffff',
            background_color: '#ffffff',
            display: 'standalone',
            start_url: './',
            scope: './',
            orientation: 'any',
            icons: [
              {
                src: 'apple-touch-icon.png',
                sizes: '180x180',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: 'pwa-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: 'pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: 'pwa-maskable-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
              },
            ],
          },
          devOptions: {
            enabled: false,
            type: 'module',
          },
        }),
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

