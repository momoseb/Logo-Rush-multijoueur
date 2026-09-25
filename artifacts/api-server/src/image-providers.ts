import type { Theme } from "@workspace/db";

// Turns a catalog item's `imageRef` into the string the *client* uses to
// fetch the image — never a server-resolved/proxied URL. A server-side
// image proxy was tried for the brands theme (hide the domain behind the
// same round token used for the id) and had to be reverted: Brandfetch's
// CDN actively rejects non-browser requests ("automated_traffic", see the
// AGENTS.md gotcha), which broke every logo image in production. The
// browser has to hotlink `cdn.brandfetch.io` directly, so this just tags
// the value as `brandfetch://<domain>` for `getBrandfetchUrl` (frontend)
// to resolve, exactly like before any of this existed.
//
// The other providers (football-data/tmdb/rawg) were never proxied to
// begin with: their imageRef is already a direct, static CDN URL that
// doesn't reveal the answer the way a brand's own domain does, so it's
// simply passed through as-is.
export function toClientImageUrl(theme: Pick<Theme, "imageProvider"> | undefined, imageRef: string): string {
  if (theme?.imageProvider === "brandfetch") return `brandfetch://${imageRef}`;
  return imageRef;
}
