import fs from 'node:fs';
import path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import {
  NOT_FOUND_SEO,
  OG_IMAGE_ALT,
  OG_IMAGE_PATH,
  OG_IMAGE_SIZE,
  SEO_ROUTES,
  SITE_NAME,
  type SeoRoute,
} from './src/lib/seo-routes';

// The app is a client-rendered SPA, so without help every URL would ship the
// same <head> and an empty <div id="root">. This plugin fixes that at build
// time, without SSR:
//   • fills the SEO markers in index.html (title, description, canonical,
//     Open Graph/Twitter, JSON-LD) — for dev, and for "/" in the build;
//   • emits one prerendered HTML file per public route (about/index.html…)
//     with its own head + static French content inside #root;
//   • emits 404.html (noindex; Vercel serves it with a real 404 status, the
//     SPA then boots on top of it and renders its own NotFound page),
//     sitemap.xml and robots.txt.
// Route metadata lives in src/lib/seo-routes.ts, shared with the client.

const HEAD_START = '<!--seo-head:start-->';
const HEAD_END = '<!--seo-head:end-->';
const BODY_START = '<!--seo-body:start-->';
const BODY_END = '<!--seo-body:end-->';

/**
 * The public origin. Never hardcode a domain here: a wrong canonical points
 * search engines at a site we don't own. Precedence: explicit VITE_SITE_URL
 * (set this once the custom domain exists) → SITE_URL → the production URL
 * Vercel injects at build time. Empty → absolute-URL tags are simply omitted.
 */
export function resolveSiteUrl(): string {
  const raw =
    process.env.VITE_SITE_URL || process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || '';
  if (!raw) return '';
  const withProtocol = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, '');
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const pageUrl = (siteUrl: string, routePath: string) => (routePath === '/' ? `${siteUrl}/` : `${siteUrl}${routePath}`);

function jsonLd(siteUrl: string, route: SeoRoute): string {
  const description = route.description.fr;
  const graph = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      inLanguage: ['fr', 'en'],
      description,
      ...(siteUrl && { url: `${siteUrl}/` }),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'VideoGame',
      name: SITE_NAME,
      description,
      genre: ['Quiz', 'Trivia'],
      applicationCategory: 'Game',
      gamePlatform: 'Web browser',
      operatingSystem: 'Any',
      playMode: ['SinglePlayer', 'MultiPlayer'],
      inLanguage: ['fr', 'en'],
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      ...(siteUrl && { url: `${siteUrl}/`, image: `${siteUrl}${OG_IMAGE_PATH}` }),
    },
  ];
  // "<" escaped so a description can never close the script element.
  return `<script type="application/ld+json">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script>`;
}

function buildHead(route: SeoRoute, siteUrl: string): string {
  const { title, description } = { title: route.title.fr, description: route.description.fr };
  const url = siteUrl && route.index ? pageUrl(siteUrl, route.path) : '';
  const image = siteUrl ? `${siteUrl}${OG_IMAGE_PATH}` : '';

  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<meta name="robots" content="${route.index ? 'index, follow, max-image-preview:large' : 'noindex, nofollow'}" />`,
    url && `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="fr_FR" />`,
    `<meta property="og:locale:alternate" content="en_US" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    url && `<meta property="og:url" content="${esc(url)}" />`,
    image && `<meta property="og:image" content="${esc(image)}" />`,
    image && `<meta property="og:image:width" content="${OG_IMAGE_SIZE.width}" />`,
    image && `<meta property="og:image:height" content="${OG_IMAGE_SIZE.height}" />`,
    image && `<meta property="og:image:alt" content="${esc(OG_IMAGE_ALT.fr)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    image && `<meta name="twitter:image" content="${esc(image)}" />`,
    image && `<meta name="twitter:image:alt" content="${esc(OG_IMAGE_ALT.fr)}" />`,
    route.index && route.path === '/' && jsonLd(siteUrl, route),
  ];
  return tags.filter(Boolean).join('\n    ');
}

const NAV_LINKS: [string, string][] = [
  ['/', 'Accueil'],
  ['/solo', 'Jouer en solo'],
  ['/leaderboard', 'Classement'],
  ['/about', 'À propos'],
];

// Inline styles only: Tailwind wouldn't see classes written from here, and the
// stylesheet's CSS variables (theme colours) are available before first paint.
function buildBody(route: SeoRoute): string {
  const p = route.prerender;
  if (!p) return '';
  const sections = (p.sections ?? [])
    .map(
      (s) =>
        `<h2 style="font-size:1.25rem;font-weight:700;margin:2rem 0 .5rem">${esc(s.title)}</h2>` +
        `<ul style="list-style:none;margin:0;padding:0">${s.items.map((i) => `<li style="margin:.25rem 0">${esc(i)}</li>`).join('')}</ul>`,
    )
    .join('');
  const nav = NAV_LINKS.filter(([href]) => href !== route.path)
    .map(([href, label]) => `<a href="${href}" style="color:hsl(var(--primary));margin:0 .5rem">${esc(label)}</a>`)
    .join('');
  return (
    `<main data-seo-fallback style="max-width:42rem;margin:0 auto;padding:4rem 1rem;text-align:center;line-height:1.5">` +
    `<h1 style="font-size:clamp(2rem,7vw,3.5rem);font-weight:800;line-height:1.1;margin:0 0 1rem">${esc(p.h1)}</h1>` +
    `<p style="color:hsl(var(--muted-foreground));font-size:1.125rem;margin:0">${esc(p.lead)}</p>` +
    sections +
    `<nav aria-label="Navigation" style="margin-top:2.5rem">${nav}</nav>` +
    `</main>`
  );
}

function fill(html: string, start: string, end: string, content: string): string {
  const a = html.indexOf(start);
  const b = html.indexOf(end);
  if (a === -1 || b === -1 || b < a) {
    throw new Error(`[seo] marker ${start} … ${end} not found in index.html — keep both markers in the template.`);
  }
  return html.slice(0, a + start.length) + `\n    ${content}\n    ` + html.slice(b);
}

function render(template: string, route: SeoRoute, siteUrl: string): string {
  const withHead = fill(template, HEAD_START, HEAD_END, buildHead(route, siteUrl));
  const bodyStart = withHead.indexOf(BODY_START);
  // The body markers wrap #root's content; leave them tight (no extra newline).
  const bodyEnd = withHead.indexOf(BODY_END);
  if (bodyStart === -1 || bodyEnd === -1 || bodyEnd < bodyStart) {
    throw new Error(`[seo] marker ${BODY_START} … ${BODY_END} not found in index.html.`);
  }
  return withHead.slice(0, bodyStart + BODY_START.length) + buildBody(route) + withHead.slice(bodyEnd);
}

const notFoundRoute: SeoRoute = {
  path: '/404',
  index: false,
  title: NOT_FOUND_SEO.title,
  description: NOT_FOUND_SEO.description,
  prerender: { h1: 'Page introuvable', lead: NOT_FOUND_SEO.description.fr },
};

export function seoPlugin(): Plugin {
  const siteUrl = resolveSiteUrl();
  let config: ResolvedConfig;
  const home = SEO_ROUTES.find((r) => r.path === '/')!;

  return {
    name: 'logo-rush-seo',

    // Lets the client (components/seo-manager.tsx) build the same canonical
    // URLs the prerendered HTML uses; '' → it falls back to location.origin.
    config() {
      return { define: { 'import.meta.env.VITE_SITE_URL': JSON.stringify(siteUrl) } };
    },

    configResolved(resolved) {
      config = resolved;
      if (config.command === 'build' && !siteUrl) {
        console.warn(
          '\n[seo] No site URL: set VITE_SITE_URL (e.g. https://logorush.fr). Building without canonical/og:url/og:image/sitemap.\n',
        );
      }
    },

    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return render(html, home, siteUrl);
      },
    },

    writeBundle() {
      if (config.command !== 'build') return;
      const outDir = config.build.outDir;
      const template = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');

      for (const route of SEO_ROUTES) {
        const file = route.path === '/' ? 'index.html' : path.join(route.path.slice(1), 'index.html');
        const target = path.join(outDir, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, render(template, route, siteUrl));
      }
      fs.writeFileSync(path.join(outDir, '404.html'), render(template, notFoundRoute, siteUrl));

      if (siteUrl) {
        const urls = SEO_ROUTES.filter((r) => r.index)
          .map((r) => `  <url><loc>${esc(pageUrl(siteUrl, r.path))}</loc></url>`)
          .join('\n');
        fs.writeFileSync(
          path.join(outDir, 'sitemap.xml'),
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
        );
      }
      fs.writeFileSync(
        path.join(outDir, 'robots.txt'),
        `User-agent: *\nAllow: /\n${siteUrl ? `\nSitemap: ${siteUrl}/sitemap.xml\n` : ''}`,
      );
    },
  };
}
