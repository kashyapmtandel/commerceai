export const prerender = true; // this can be fully static — it doesn't need per-request data

const SITE = 'https://commerceai.online';

// Add new pages here when you add new tools/pages to the site.
const routes = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/product-schema-generator', priority: '0.9', changefreq: 'monthly' },
  { path: '/about', priority: '0.6', changefreq: 'monthly' },
  { path: '/contact', priority: '0.5', changefreq: 'monthly' },
  { path: '/privacy', priority: '0.3', changefreq: 'yearly' },
  { path: '/terms', priority: '0.3', changefreq: 'yearly' },
];

export async function GET() {
  const lastmod = new Date().toISOString().split('T')[0];

  const urls = routes
    .map(
      (r) => `  <url>
    <loc>${SITE}${r.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: { 'Content-Type': 'application/xml' },
  });
}
