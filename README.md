# Commerce AI — Astro Migration

This replaces the previous plain HTML/CSS/JS site with an Astro build. Same visual design, same URLs, same Vercel hosting — the difference is entirely under the hood:

- **CSS/JS are now content-hashed automatically** (`/_astro/style.a3f8c1.css`), so the year-long cache-busting bug can't happen again — no more manual `?v=` bumps.
- **Nav and footer are single components** (`src/components/Nav.astro`, `Footer.astro`). Add a new tool once, it's live on every page — no more hand-editing 6 files.
- **The stale `public/css`, `public/js` duplicate is gone.** There's exactly one copy of everything now.
- **Sitemap is generated automatically** from a route list in `src/pages/sitemap.xml.js` — add a page there instead of maintaining a separate XML file that's easy to forget.

## Local setup

```bash
npm install
npm run dev       # http://localhost:4321
```

## Build & preview

```bash
npm run build
npm run preview
```

## Deploy

Push this to your GitHub repo (replacing the old contents) and connect it to the same Vercel project — Vercel will detect Astro automatically. If you'd rather set it up fresh:

```bash
npx vercel
```

The `@astrojs/vercel` adapter generates the correct Vercel function/routing config at build time, so the old `vercel.json` `builds`/`routes` sections are gone — only security headers remain in `vercel.json` now.

## What to remove from the old repo

Once this is deployed and verified working, delete these from the old structure (all superseded):

- `*.html` at repo root (all converted to `src/pages/*.astro`)
- `css/`, `js/` (moved into `src/styles`, `src/scripts` — now processed/hashed by the build)
- `public/css/`, `public/js/` (the stale duplicate — no longer relevant, this whole pattern doesn't exist in the new structure)
- `api/` (converted to `src/pages/api/check.js`; `sitemap.js`/`robots.js` no longer needed — sitemap is dynamic, robots.txt is a plain file in `public/`)
- `sitemap.xml` (now generated dynamically at `/sitemap.xml`)

## Post-deploy checklist

1. Load `/` and `/product-schema-generator` — confirm the two-column card layout renders (this was the original bug).
2. View source on any page, search for `/_astro/` — confirm CSS/JS load from hashed filenames, not `/css/style.css`.
3. Test the UCP checker end-to-end (`/api/check` is now an Astro server endpoint, not a Vercel function file — behavior should be identical, but worth confirming a live scan works).
4. Check `/sitemap.xml` renders correctly and lists all 6 pages.
5. In Google Search Console: resubmit the sitemap, and use URL Inspection → Request Indexing on `/product-schema-generator` since its URL structure hasn't changed but the underlying render pipeline has.

## Adding a new tool page going forward

1. Add `src/pages/your-tool.astro` (copy `product-schema-generator.astro` as a starting template).
2. Add the link to `src/components/Nav.astro` and `src/components/Footer.astro` — once each, not per-page.
3. Add a route entry to `src/pages/sitemap.xml.js`.
4. If it needs its own client-side logic, add a script under `src/scripts/` and import it the same way `product-schema-generator.js` is imported.
