import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium text-xs tracking-tight transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-emerald/40 disabled:pointer-events-none disabled:opacity-40 cursor-pointer select-none rounded-xl";

    const variants = {
      primary:
        "bg-signal-emerald text-[#0B0D10] font-semibold hover:bg-[#00c985] active:scale-[0.98] border border-transparent shadow-sm",
      secondary:
        "bg-surface-elevated text-text-primary hover:bg-[#252C38] active:scale-[0.98] border border-border",
      outline:
        "bg-transparent text-text-primary hover:bg-surface-elevated border border-border hover:border-border-focus",
      danger:
        "bg-signal-orange/10 text-signal-orange border border-signal-orange/20 hover:bg-signal-orange/20",
      ghost:
        "bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-elevated border border-transparent",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs gap-1.5",
      md: "h-9 px-4 text-xs gap-2",
      lg: "h-11 px-5 text-sm gap-2.5",
      icon: "h-9 w-9",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
