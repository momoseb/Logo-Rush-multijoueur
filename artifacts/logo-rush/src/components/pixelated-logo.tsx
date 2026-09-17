import { useEffect, useRef, useState } from 'react';

type PixelatedLogoProps = {
  src: string;
  progress: number;
  reveal?: boolean;
  alt?: string;
  onStatusChange?: (status: 'loaded' | 'missing' | 'lettermark') => void;
};

export function getBrandfetchUrl(src: string, fallback = true) {
  if (!src.startsWith('brandfetch://')) return src;
  const clientId = import.meta.env.VITE_BRANDFETCH_CLIENT_ID;
  const fallbackPath = fallback ? '/fallback/lettermark' : '';
  return `https://cdn.brandfetch.io/domain/${encodeURIComponent(src.slice('brandfetch://'.length))}/w/512/h/512/type/icon${fallbackPath}?c=${encodeURIComponent(clientId || '')}`;
}
export function PixelatedLogo({ src, progress, reveal = false, alt = 'Marque à deviner', onStatusChange }: PixelatedLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'missing' | 'lettermark'>('loading');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const image = new Image();
    image.onload = () => {
      setStatus('loaded');
      onStatusChange?.('loaded');
      const size = 512;
      canvas.width = size;
      canvas.height = size;
      const normalized = Math.min(1, Math.max(0, progress));
      const resolution = reveal ? size : Math.round(8 + Math.pow(normalized, 2.2) * (size - 8));
      const buffer = document.createElement('canvas');
      buffer.width = resolution;
      buffer.height = resolution;
      const bufferContext = buffer.getContext('2d');
      if (!bufferContext) return;
      bufferContext.drawImage(image, 0, 0, resolution, resolution);
      context.clearRect(0, 0, size, size);
      context.imageSmoothingEnabled = false;
      context.drawImage(buffer, 0, 0, resolution, resolution, 0, 0, size, size);
    };
    image.onerror = () => {
      if (!src.startsWith('brandfetch://')) {
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
        const size = 512;
        canvas.width = size;
        canvas.height = size;
        context.clearRect(0, 0, size, size);
        context.drawImage(image, 0, 0, size, size);
      };
      image.src = getBrandfetchUrl(src, true);
    };
    setStatus('loading');
    image.src = getBrandfetchUrl(src, false);
  }, [src, progress, reveal, onStatusChange]);

  return (
    <div className="relative h-full w-full max-h-[32rem] max-w-[32rem]">
      <canvas ref={canvasRef} role="img" aria-label={alt} className="h-full w-full object-contain" />
      {status === 'missing' && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl border border-destructive/40 bg-destructive/10 text-sm font-semibold text-destructive">
          Image indisponible
        </div>
      )}
      {status === 'lettermark' && (
        <span className="absolute right-2 top-2 rounded-md bg-amber-500 px-2 py-1 text-xs font-bold text-black">
          Lettermark
        </span>
      )}
    </div>
  );
}
