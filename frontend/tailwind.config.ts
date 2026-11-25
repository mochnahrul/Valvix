import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0A0C10", // Deep Obsidian Canvas
        surface: {
          DEFAULT: "#12151D", // Crisp Card Surface
          elevated: "#191D28", // Elevated Interactive Surface
          subtle: "#0E1118",   // Recessed containers
        },
        border: {
          DEFAULT: "rgba(255, 255, 255, 0.07)", // Crisp hairline border
          focus: "rgba(255, 255, 255, 0.16)",
          subtle: "rgba(255, 255, 255, 0.04)",
        },
        signal: {
          emerald: "#00E599", // Vivid Emerald Accent
          orange: "#FF5500",  // Industrial Flame Accent
          blue: "#38BDF8",    // Electric Co-op Sky Blue
          purple: "#A855F7",  // Rare Trophy Purple
          muted: "#3B4452",
        },
        text: {
          primary: "#F3F4F6",
          secondary: "#8F97A3",
          dim: "#5A6270",
        },
      },
      fontFamily: {
        heading: ["'Plus Jakarta Sans'", "'Space Grotesk'", "sans-serif"],
        sans: ["Inter", "-apple-system", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        DEFAULT: "12px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
        "3xl": "24px",
        full: "9999px",
      },
      boxShadow: {
        none: "none",
        card: "0 4px 20px rgba(0, 0, 0, 0.25)",
      },
      letterSpacing: {
        tightest: "-0.035em",
        tight: "-0.02em",
        normal: "-0.011em",
        wide: "0.03em",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
