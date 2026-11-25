import React from "react";

export type SpinnerVariant = "emerald" | "blue" | "purple" | "white" | "orange" | "dark";
export type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl";

interface LoadingSpinnerProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  className?: string;
}

const sizeMap: Record<SpinnerSize, { dim: string; stroke: number }> = {
  xs: { dim: "w-3 h-3", stroke: 3 },
  sm: { dim: "w-3.5 h-3.5", stroke: 2.8 },
  md: { dim: "w-5 h-5", stroke: 2.5 },
  lg: { dim: "w-8 h-8", stroke: 2.2 },
  xl: { dim: "w-11 h-11", stroke: 2 },
};

const variantColorMap: Record<SpinnerVariant, { primary: string; glow: string }> = {
  emerald: { primary: "text-signal-emerald", glow: "rgba(0, 229, 153, 0.15)" },
  blue: { primary: "text-signal-blue", glow: "rgba(56, 189, 248, 0.15)" },
  purple: { primary: "text-signal-purple", glow: "rgba(168, 85, 247, 0.15)" },
  orange: { primary: "text-signal-orange", glow: "rgba(255, 85, 0, 0.15)" },
  white: { primary: "text-text-primary", glow: "rgba(255, 255, 255, 0.1)" },
  dark: { primary: "text-[#0B0D10]", glow: "rgba(0, 0, 0, 0.2)" },
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "md",
  variant = "emerald",
  className = "",
}) => {
  const { dim, stroke } = sizeMap[size] || sizeMap.md;
  const { primary } = variantColorMap[variant] || variantColorMap.emerald;

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${dim} ${className}`}>
      <svg
        className={`w-full h-full animate-spin ${primary}`}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Subtle background circular track */}
        <circle
          cx="12"
          cy="12"
          r="9.5"
          stroke="currentColor"
          strokeWidth={stroke}
          opacity="0.16"
        />
        {/* Active glowing sweep arc */}
        <path
          d="M12 2.5C17.2467 2.5 21.5 6.75329 21.5 12C21.5 14.5 20.5 16.8 18.8 18.5"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

interface LoadingStateProps {
  message?: string;
  subMessage?: string;
  variant?: SpinnerVariant;
  size?: SpinnerSize;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = "Loading...",
  subMessage,
  variant = "emerald",
  size = "lg",
  className = "",
}) => {
  const { glow } = variantColorMap[variant] || variantColorMap.emerald;

  return (
    <div className={`flex flex-col items-center justify-center py-10 px-4 text-center select-none ${className}`}>
      {/* Outer ambient aura */}
      <div className="relative mb-3 flex items-center justify-center">
        <div
          className="absolute inset-0 rounded-full blur-xl pointer-events-none scale-150 animate-pulse"
          style={{ backgroundColor: glow }}
        />
        <LoadingSpinner size={size} variant={variant} />
      </div>

      {message && (
        <p className="text-xs font-heading font-bold text-text-primary tracking-tight">
          {message}
        </p>
      )}

      {subMessage && (
        <p className="text-[11px] font-mono text-text-secondary mt-1">
          {subMessage}
        </p>
      )}
    </div>
  );
};
