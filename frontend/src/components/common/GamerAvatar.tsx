import { useState } from "react";
import { cn } from "@/lib/utils";

interface GamerAvatarProps {
  src?: string;
  alt: string;
  className?: string;
  color?: string; // Hex color for the fallback badge
}

export function GamerAvatar({
  src,
  alt,
  className,
  color = "#00E599",
}: GamerAvatarProps) {
  const [hasError, setHasError] = useState(false);

  // Extract initials (up to 2 letters)
  const initials = alt
    .split(/\s|[/_]/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "V";

  if (!src || hasError) {
    return (
      <div
        className={cn(
          "rounded-full bg-surface-elevated border border-border flex items-center justify-center font-heading font-extrabold select-none shrink-0 text-text-primary",
          className
        )}
        style={{ borderColor: `${color}40` }}
        title={alt}
      >
        <span
          className="text-xs tracking-wider"
          style={{ color }}
        >
          {initials}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      className={cn("rounded-full object-cover shrink-0 select-none", className)}
    />
  );
}
