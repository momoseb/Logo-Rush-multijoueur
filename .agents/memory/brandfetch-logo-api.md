---
name: Brandfetch Logo API usage
description: Why Logo Rush must load Brandfetch logos directly in the browser.
---

Use Brandfetch Logo API URLs directly in browser image requests. Do not proxy, cache, or re-host the logo bytes on the API server.

**Why:** Brandfetch documents direct HTML embedding as the supported usage. Server-like requests may return `403` or redirect to the guidelines page even when the same active Client ID returns an image to a browser request.

**How to apply:** Keep the Logo API Client ID in the public `VITE_BRANDFETCH_CLIENT_ID` variable and resolve `brandfetch://` logo references in the frontend.