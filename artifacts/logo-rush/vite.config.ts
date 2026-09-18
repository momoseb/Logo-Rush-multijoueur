import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// PORT/BASE_PATH only matter for `vite dev`/`vite preview` (a plain `vite
// build`, as used by Vercel, ignores both). Default them instead of
// requiring them, so the project builds in any environment.
const port = Number(process.env.PORT) || 5173;
const basePath = process.env.BASE_PATH || '/';
const devApiProxyTarget = process.env.VITE_DEV_API_PROXY_TARGET || 'http://127.0.0.1:5000';

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
    // Only relevant when the API isn't deployed separately (VITE_API_BASE_URL
    // unset) — lets `vite dev` reach a locally-running api-server without a
    // router in front of both services. Point it at a deployed backend via
    // VITE_DEV_API_PROXY_TARGET if you'd rather not run one locally.
    proxy: {
      '/api': devApiProxyTarget,
      '/socket.io': { target: devApiProxyTarget, ws: true },
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
