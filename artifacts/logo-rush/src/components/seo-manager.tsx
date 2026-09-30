import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { resolveSeo, type SeoLocale } from '@/lib/seo-routes';

// Keeps <title>, meta description, canonical, robots, Open Graph/Twitter text
// and <html lang> in step with the current route and language. The static
// HTML (see vite-plugin-seo.ts) already carries the right values for the first
// paint of every public route; this covers client-side navigation and the
// language switch, which don't reload the page. Mounted once in App.tsx.

function setMeta(attr: 'name' | 'property', key: string, content: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (content === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href: string | null) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (href === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function SeoManager() {
  const [location] = useLocation();
  const { i18n } = useTranslation();
  const locale: SeoLocale = i18n.language?.startsWith('en') ? 'en' : 'fr';

  useEffect(() => {
    const seo = resolveSeo(location);
    const title = seo.title[locale];
    const description = seo.description[locale];
    // VITE_SITE_URL (injected by the seo plugin) pins the canonical origin so
    // www/apex/preview hosts all point at one URL; without it, use this host.
    const origin = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/+$/, '');
    const url = seo.index ? `${origin}${seo.path === '/' ? '/' : seo.path}` : null;

    document.documentElement.lang = locale;
    document.title = title;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', seo.index ? 'index, follow, max-image-preview:large' : 'noindex, nofollow');
    setCanonical(url);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:locale', locale === 'en' ? 'en_US' : 'fr_FR');
    setMeta('property', 'og:locale:alternate', locale === 'en' ? 'fr_FR' : 'en_US');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
  }, [location, locale]);

  return null;
}
