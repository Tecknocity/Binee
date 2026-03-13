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
  'icon-white': '/Binee__icon__white.png',
  'icon-black': '/Binee__icon__black.png',
};

/**
 * Renders the Binee logo as an SVG inline fallback when PNG files
 * are not yet in /public, or as an <Image> when they are available.
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

  // Try PNG first — if the files exist in /public they'll be served
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

/**
 * Inline SVG version of the Binee cube icon for use when PNG files
 * are unavailable (e.g., favicon fallback, loading states).
 */
export function BineeIconSvg({
  size = 32,
  variant = 'white',
  className,
}: {
  size?: number;
  variant?: 'white' | 'black';
  className?: string;
}) {
  const isWhite = variant === 'white';
  // white variant: light hexagon bg + purple cube
  // black variant: purple hexagon bg + white cube
  const hexFill = isWhite ? '#E8E8EE' : '#854DF9';
  const cubeFill = isWhite ? '#854DF9' : '#FFFFFF';
  const cubeDark = isWhite ? '#7040E0' : '#E8E8EE';
  const cubeLight = isWhite ? '#9D6FFA' : '#FFFFFF';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Hexagon background */}
      <path
        d="M50 2L93.3 27v46L50 98 6.7 73V27L50 2z"
        fill={hexFill}
      />
      {/* Open box / cube — top face (chevron) */}
      <path
        d="M50 25L75 39L50 53L25 39L50 25z"
        fill={cubeFill}
      />
      {/* Left face */}
      <path
        d="M25 39L50 53V75L25 61V39z"
        fill={cubeDark}
      />
      {/* Right face */}
      <path
        d="M75 39L50 53V75L75 61V39z"
        fill={cubeLight}
      />
      {/* Inner cutout (white/transparent center to create open box effect) */}
      <path
        d="M50 45L62 39L50 33L38 39L50 45z"
        fill={hexFill}
      />
      <path
        d="M38 39L50 45V57L38 51V39z"
        fill={hexFill}
      />
      <path
        d="M62 39L50 45V57L62 51V39z"
        fill={hexFill}
      />
    </svg>
  );
}
