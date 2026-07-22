import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://commerceai.online',
  devToolbar: {
    enabled: false
  },
  output: 'static', // pages are static by default; src/pages/api/check.js opts out via `export const prerender = false`
  adapter: vercel(),
});
