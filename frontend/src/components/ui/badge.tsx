import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "emerald" | "orange" | "blue" | "purple" | "outline" | "muted";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const baseStyles =
    "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-tight select-none";

  const variants = {
    default: "bg-surface-elevated text-text-primary border border-border",
    emerald: "bg-signal-emerald/10 text-signal-emerald border border-signal-emerald/20",
    orange: "bg-signal-orange/10 text-signal-orange border border-signal-orange/20",
    blue: "bg-signal-blue/10 text-signal-blue border border-signal-blue/20",
    purple: "bg-signal-purple/10 text-signal-purple border border-signal-purple/20",
    outline: "bg-transparent text-text-secondary border border-border",
    muted: "bg-surface-subtle text-text-secondary border border-border/40",
  };

  return <div className={cn(baseStyles, variants[variant], className)} {...props} />;
}
