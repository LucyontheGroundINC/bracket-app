// components/Avatar.tsx
"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

function getInitials(nameOrEmail: string | null | undefined) {
  if (!nameOrEmail) return "U";
  const s = nameOrEmail.trim();
  if (!s) return "U";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s[0]!.toUpperCase();
}

function getGradient(seed: string): { background: string } {
  const colors: [string, string][] = [
    ["#FF6B6B", "#E63946"],
    ["#F97316", "#EA580C"],
    ["#FACC15", "#EAB308"],
    ["#4ADE80", "#16A34A"],
    ["#06B6D4", "#0891B2"],
    ["#3B82F6", "#1D4ED8"],
    ["#6366F1", "#4338CA"],
    ["#8B5CF6", "#6D28D9"],
    ["#D946EF", "#A21CAF"],
    ["#EC4899", "#BE185D"],
    ["#F43F5E", "#BE123C"],
  ];

  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % colors.length;
  const [start, end] = colors[idx];
  return { background: `linear-gradient(135deg, ${start}, ${end})` };
}

export default function Avatar({
  name,
  email,
  src,
  size = 48,
  className = "",
}: {
  name?: string | null;
  email?: string | null;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  // Normalize src: treat empty string as "no src"
  const imageSrc = useMemo(() => {
    const s = (src ?? "").trim();
    return s.length ? s : null;
  }, [src]);

  const seed = (email || name || "user").toLowerCase();
  const initials = getInitials(name ?? email);

  const style: CSSProperties = {
    ...getGradient(seed),
    width: size,
    height: size,
    lineHeight: `${size}px`,
    fontSize: Math.max(12, Math.floor(size / 3)),
  };

  // If we have a src and it hasn't failed, render the image.
  if (imageSrc && !imgFailed) {
    return (
      <div
        className={`relative rounded-full overflow-hidden ${className}`}
        style={{ width: size, height: size }}
        aria-label={`Avatar ${name || email || ""}`}
        title={name || email || ""}
      >
        <Image
          src={imageSrc}
          alt={name || email || "Avatar"}
          fill
          sizes={`${size}px`}
          className="object-cover"
          onError={() => setImgFailed(true)}
          // If your avatar URLs are dynamic and you don't want Next caching surprises:
          // unoptimized
        />
      </div>
    );
  }

  // Fallback: initials
  return (
    <div
      className={`rounded-full text-white font-semibold text-center select-none drop-shadow flex items-center justify-center ${className}`}
      style={style}
      aria-label={`Avatar ${name || email || ""}`}
      title={name || email || ""}
    >
      {initials}
    </div>
  );
}


