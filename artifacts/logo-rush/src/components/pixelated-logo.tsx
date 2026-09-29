import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

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

// Brandfetch's CDN must be hotlinked directly by the browser: it actively
// rejects server-to-server requests (responds with a redirect to its own
// docs site, `x-bf-error: automated_traffic`), so this can't be proxied
// through our own API the way the answer/catalog id are hidden — see the
// AGENTS.md gotcha. The brand domain is therefore visible in this request
// once a round is live, same as before the anti-cheat token scheme existed.
export function getBrandfetchUrl(src: string, fallback = true) {
  if (!src.startsWith('brandfetch://')) return src;
  const clientId = import.meta.env.VITE_BRANDFETCH_CLIENT_ID;
  const fallbackPath = fallback ? '/fallback/lettermark' : '';
  return `https://cdn.brandfetch.io/domain/${encodeURIComponent(src.slice('brandfetch://'.length))}/w/512/h/512/type/icon${fallbackPath}?c=${encodeURIComponent(clientId || '')}`;
}
// Reveal curve: resolution (on the image's long edge, 8 → 512 px) as a
// function of round progress. Interpolated on a log scale, since what the
// eye perceives is the *ratio* between successive block sizes, not their
// difference: the old `8 + n^2.2 * 504` curve barely moved for the first
// ~30% of a round (unreadable mosaic) then cleared the image almost
// entirely between 30% and 60%. `n^0.75` in log space starts a bit faster
// and spreads the last, most revealing steps over the rest of the round:
//   progress     0.1  0.2  0.3  0.4  0.5  0.6  0.7  0.8  0.9
//   old (px)      11   22   43   75  118  172  238  316  408
//   new (px)      17   28   43   65   95  136  193  270  373
const MIN_RESOLUTION = 8;
const REVEAL_EXPONENT = 0.75;
const LONG_EDGE = 512;

export function pixelResolution(progress: number) {
  const normalized = Math.min(1, Math.max(0, progress));
  return Math.round(MIN_RESOLUTION * Math.pow(LONG_EDGE / MIN_RESOLUTION, Math.pow(normalized, REVEAL_EXPONENT)));
}

type LoadedImage = { image: HTMLImageElement; kind: 'loaded' | 'lettermark' };

export function PixelatedLogo({ src, progress, reveal = false, alt, aspectRatio = { w: 1, h: 1 }, onStatusChange }: PixelatedLogoProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'missing' | 'lettermark'>('loading');
  const [loaded, setLoaded] = useState<LoadedImage | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  // Load each image once per `src` — progress ticks (~10/s) only redraw
  // from the already-decoded image below, they never hit the network again.
  useEffect(() => {
    let cancelled = false;
    const report = (next: 'loaded' | 'missing' | 'lettermark') => {
      if (cancelled) return;
      setStatus(next);
      onStatusChangeRef.current?.(next);
    };
    setStatus('loading');
    setLoaded(null);
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      setLoaded({ image, kind: 'loaded' });
      report('loaded');
    };
    image.onerror = () => {
      if (!src.startsWith('brandfetch://')) {
        report('missing');
        return;
      }
      image.onerror = () => report('missing');
      image.onload = () => {
        if (cancelled) return;
        setLoaded({ image, kind: 'lettermark' });
        report('lettermark');
      };
      image.src = getBrandfetchUrl(src, true);
    };
    image.src = getBrandfetchUrl(src, false);
    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [src]);

  // The canvas takes the image's own proportions (not the theme's nominal
  // aspect ratio, which is only a placeholder until it loads): e.g. RAWG
  // "covers" are really landscape key art, and forcing them into the
  // theme's frame used to squash them.
  const naturalW = loaded?.image.naturalWidth || aspectRatio.w;
  const naturalH = loaded?.image.naturalHeight || aspectRatio.h;
  const width = naturalW >= naturalH ? LONG_EDGE : Math.round((LONG_EDGE * naturalW) / naturalH);
  const height = naturalH >= naturalW ? LONG_EDGE : Math.round((LONG_EDGE * naturalH) / naturalW);
  const resolution = reveal || loaded?.kind === 'lettermark' ? LONG_EDGE : pixelResolution(progress);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !loaded) return;
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    if (resolution >= LONG_EDGE) {
      context.imageSmoothingEnabled = true;
      context.drawImage(loaded.image, 0, 0, width, height);
      return;
    }
    const bufferWidth = Math.max(1, Math.round((resolution * width) / LONG_EDGE));
    const bufferHeight = Math.max(1, Math.round((resolution * height) / LONG_EDGE));
    const buffer = document.createElement('canvas');
    buffer.width = bufferWidth;
    buffer.height = bufferHeight;
    const bufferContext = buffer.getContext('2d');
    if (!bufferContext) return;
    bufferContext.drawImage(loaded.image, 0, 0, bufferWidth, bufferHeight);
    context.imageSmoothingEnabled = false;
    context.drawImage(buffer, 0, 0, bufferWidth, bufferHeight, 0, 0, width, height);
  }, [loaded, resolution, width, height]);

  return (
    // Fills whatever box the caller gives it; the canvas keeps the image's
    // proportions inside it (object-contain), never stretched or cropped.
    <div className="relative flex h-full w-full items-center justify-center">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        role="img"
        aria-label={alt ?? t('common.imageToGuess')}
        className="max-h-full max-w-full rounded-lg object-contain"
        style={{ aspectRatio: `${width} / ${height}` }}
      />
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
