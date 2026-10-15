import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 1600,
  },
  plugins: [
    // Installable app: phones can add the game to their home screen, where it opens without
    // the browser bars and keeps working offline. New versions download in the background and
    // apply the next time the game is opened.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      manifest: {
        id: './',
        name: 'Padelirium: Noche de Invasión',
        short_name: 'Padelirium',
        description:
          'Unos extraterrestres tomaron el club de pádel. Juega solo o en pareja, rescata a tus amigos y descubre quién está detrás de la invasión.',
        lang: 'es',
        start_url: './',
        scope: './',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'landscape',
        background_color: '#0a0a0f',
        theme_color: '#0a0a0f',
        categories: ['games'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          // The artwork fills the whole square, so Android can crop it to its own shape.
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The whole game (code, art and the cover) is stored on the phone the first time.
        globPatterns: ['**/*.{js,css,html,png,jpg,webmanifest}'],
        // Only link previews use it.
        globIgnores: ['og-image.jpg'],
        // Phaser alone is bigger than Workbox's 2 MB default.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
