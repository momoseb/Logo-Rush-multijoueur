import type { Theme } from "@workspace/db";

const BRANDFETCH_CDN_CLIENT_ID = process.env.BRANDFETCH_CLIENT_ID || "1idke8AlkDn4BHhX1fs";

// Resolves a catalog item's `imageRef` into an actual fetchable image URL,
// dispatching on the item's theme.imageProvider. Only "brandfetch" builds
// its URL live from a bare domain (imageRef = domain, e.g. "apple.com") —
// this mirrors the original brand-logo behavior exactly. The other
// providers (TheSportsDB, TMDB, IGDB) don't have Brandfetch's "logo by
// domain" API, so their imageRef is instead a direct, stable CDN URL
// resolved once by the matching scripts/src/seed-catalog/seed-*.ts script
// at content-authoring time — no live third-party API call (and no API
// credentials) is needed on the hot gameplay path for those themes.
export function resolveImageUrl(theme: Pick<Theme, "imageProvider">, imageRef: string, fallback: boolean): string {
  switch (theme.imageProvider) {
    case "brandfetch": {
      const fallbackPath = fallback ? "/fallback/lettermark" : "";
      return `https://cdn.brandfetch.io/domain/${encodeURIComponent(imageRef)}/w/512/h/512/type/icon${fallbackPath}?c=${encodeURIComponent(BRANDFETCH_CDN_CLIENT_ID)}`;
    }
    case "thesportsdb":
    case "tmdb":
    case "igdb":
      return imageRef;
    default:
      throw new Error(`Unknown image provider: ${theme.imageProvider}`);
  }
}
