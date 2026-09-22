import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiUrl } from '@/lib/api-base';

type PixelatedLogoProps = {
  src: string;
  progress: number;
  reveal?: boolean;
  alt?: string;
  /** Theme-dependent aspect ratio (e.g. 1/1 for logos and crests, 2/3 for
   * movie posters). Defaults to square so existing brand/club callers are
   * unaffected. */
  aspectRatio?: { w: number; h: number };
  onStatusChange?: (status: 'loaded' | 'missing' | 'lettermark') => void;
};

export function getBrandfetchUrl(src: string, fallback = true) {
  // Gameplay logos (solo and multiplayer) are served through the API's
  // image proxy behind an opaque per-round token — the client never learns
  // the real brand domain before the round ends. Only the internal
  // /logo-audit tool still uses raw `brandfetch://<domain>` URLs directly.
  if (src.startsWith('logotoken://')) {
    const token = src.slice('logotoken://'.length);
    return apiUrl(`/api/game/logo-image/${encodeURIComponent(token)}${fallback ? '?fallback=1' : ''}`);
  }
  if (!src.startsWith('brandfetch://')) return src;
  const clientId = import.meta.env.VITE_BRANDFETCH_CLIENT_ID;
  const fallbackPath = fallback ? '/fallback/lettermark' : '';
  return `https://cdn.brandfetch.io/domain/${encodeURIComponent(src.slice('brandfetch://'.length))}/w/512/h/512/type/icon${fallbackPath}?c=${encodeURIComponent(clientId || '')}`;
}
export function PixelatedLogo({ src, progress, reveal = false, alt, aspectRatio = { w: 1, h: 1 }, onStatusChange }: PixelatedLogoProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'missing' | 'lettermark'>('loading');

  const longEdge = 512;
  const width = aspectRatio.w >= aspectRatio.h ? longEdge : Math.round((longEdge * aspectRatio.w) / aspectRatio.h);
  const height = aspectRatio.h >= aspectRatio.w ? longEdge : Math.round((longEdge * aspectRatio.h) / aspectRatio.w);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const image = new Image();
    image.onload = () => {
      setStatus('loaded');
      onStatusChange?.('loaded');
      canvas.width = width;
      canvas.height = height;
      const normalized = Math.min(1, Math.max(0, progress));
      const longEdgeResolution = reveal ? longEdge : Math.round(8 + Math.pow(normalized, 2.2) * (longEdge - 8));
      const bufferWidth = Math.max(1, Math.round((longEdgeResolution * width) / longEdge));
      const bufferHeight = Math.max(1, Math.round((longEdgeResolution * height) / longEdge));
      const buffer = document.createElement('canvas');
      buffer.width = bufferWidth;
      buffer.height = bufferHeight;
      const bufferContext = buffer.getContext('2d');
      if (!bufferContext) return;
      bufferContext.drawImage(image, 0, 0, bufferWidth, bufferHeight);
      context.clearRect(0, 0, width, height);
      context.imageSmoothingEnabled = false;
      context.drawImage(buffer, 0, 0, bufferWidth, bufferHeight, 0, 0, width, height);
    };
    image.onerror = () => {
      if (!src.startsWith('brandfetch://') && !src.startsWith('logotoken://')) {
        setStatus('missing');
        onStatusChange?.('missing');
        return;
      }
      image.onerror = () => {
        setStatus('missing');
        onStatusChange?.('missing');
      };
      image.onload = () => {
        setStatus('lettermark');
        onStatusChange?.('lettermark');
        canvas.width = width;
        canvas.height = height;
        context.clearRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
      };
      image.src = getBrandfetchUrl(src, true);
    };
    setStatus('loading');
    image.src = getBrandfetchUrl(src, false);
  }, [src, progress, reveal, width, height, onStatusChange]);

  return (
    <div className="relative h-full w-full" style={{ maxHeight: '32rem', maxWidth: `${32 * (width / longEdge)}rem`, aspectRatio: `${aspectRatio.w} / ${aspectRatio.h}` }}>
      <canvas ref={canvasRef} role="img" aria-label={alt ?? t('common.imageToGuess')} className="h-full w-full object-contain" />
      {status === 'missing' && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl border border-destructive/40 bg-destructive/10 text-sm font-semibold text-destructive">
          {t('common.imageUnavailable')}
        </div>
      )}
      {status === 'lettermark' && (
        <span className="absolute right-2 top-2 rounded-md bg-amber-500 px-2 py-1 text-xs font-bold text-black">
          {t('common.lettermark')}
        </span>
      )}
    </div>
  );
}
