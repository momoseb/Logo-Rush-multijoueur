import { useEffect, useRef } from 'react';

type PixelatedLogoProps = {
  src: string;
  progress: number;
  reveal?: boolean;
  alt?: string;
};

export function PixelatedLogo({ src, progress, reveal = false, alt = 'Marque à deviner' }: PixelatedLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const image = new Image();
    image.onload = () => {
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
    image.src = src;
  }, [src, progress, reveal]);

  return <canvas ref={canvasRef} role="img" aria-label={alt} className="h-full w-full max-h-[32rem] max-w-[32rem] object-contain" />;
}