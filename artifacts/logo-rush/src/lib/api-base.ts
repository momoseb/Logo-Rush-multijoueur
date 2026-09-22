// Same-origin (empty prefix) unless the API is deployed on a different
// origin (e.g. Vercel frontend + Render backend) — see main.tsx and
// src/lib/socket.ts. Anything that talks to the API without going through
// the generated `@workspace/api-client-react` hooks (which apply this via
// `setBaseUrl`) needs to prefix its own requests with this.
export function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
  return `${base}${path}`;
}
