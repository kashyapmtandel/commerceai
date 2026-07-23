import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://commerceai.online',
  devToolbar: {
    enabled: false
  },
  output: 'static', // pages are static by default; src/pages/api/check.js opts out via `export const prerender = false`
  adapter: vercel(),
  security: {
    csp: {
      // Astro auto-generates script-src/style-src with hashes for its own
      // bundled/inline scripts. These are additional directives merged in.
      // Fonts are self-hosted via Fontsource, so no external font-src/style-src needed.
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
      ],
    },
  },
});
