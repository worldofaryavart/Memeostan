"use client";

import { useState, type CSSProperties } from "react";

// Art slot: shows a generated PNG from /public/art if present, otherwise an
// emoji/text fallback. Lets us design the whole UI now and drop in real painted
// artwork later without touching layout. (peak-brainrot3 "real page" + art slots)
export default function Art({
  src,
  alt,
  fallback,
  className,
  style,
}: {
  src?: string;
  alt: string;
  fallback: React.ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return (
      <span className={className} style={style} role="img" aria-label={alt}>
        {fallback}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} style={style} onError={() => setFailed(true)} />
  );
}
