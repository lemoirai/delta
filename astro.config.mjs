// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

// Dev only: compose.yaml sets PB_PROXY_TARGET, and the dev server forwards /api
// to the local PocketBase. The browser always calls its own origin, so the same
// URL works from the host browser and from the Playwright container.
const pbProxyTarget = process.env.PB_PROXY_TARGET;

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    server: pbProxyTarget
      ? { proxy: { '/api/': { target: pbProxyTarget, changeOrigin: true } } }
      : {},
  },
  integrations: [react()],
});
