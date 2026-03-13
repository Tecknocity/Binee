'use client';

import Image from 'next/image';

interface BineeLogoProps {
  variant: 'full-white' | 'full-black' | 'icon-white' | 'icon-black';
  width?: number;
  height?: number;
  className?: string;
}

const FILE_MAP: Record<BineeLogoProps['variant'], string> = {
  'full-white': '/Binee__full__white.png',
  'full-black': '/Binee__full__black.png',
  'icon-white': '/Binee__icon__white.svg',
  'icon-black': '/Binee__icon__black.svg',
};

/**
 * Renders the Binee logo from assets in /public.
 *
 * Icon variants use SVG for crisp scaling at any size.
 * Full variants (icon + wordmark) use PNG.
 *
 * Usage:
 *   <BineeLogo variant="icon-white" width={32} height={32} />
 *   <BineeLogo variant="full-white" width={120} height={40} />
 */
export function BineeLogo({ variant, width, height, className }: BineeLogoProps) {
  const isIcon = variant.startsWith('icon');
  const defaultW = isIcon ? 32 : 120;
  const defaultH = isIcon ? 32 : 48;
  const w = width ?? defaultW;
  const h = height ?? defaultH;

  const src = FILE_MAP[variant];

  return (
    <Image
      src={src}
      alt="Binee"
      width={w}
      height={h}
      className={className}
      priority
      unoptimized
    />
  );
}
