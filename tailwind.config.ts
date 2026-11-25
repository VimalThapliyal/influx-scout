import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-plex-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-jakarta)", "system-ui", "sans-serif"],
        // Marketing/app type tokens. Values come from CSS variables so the public
        // site (.mkt-shell, "research report" look) and the app can differ.
        poster: ["var(--mkt-display)", "system-ui", "sans-serif"],
        plex: ["var(--font-plex-sans)", "system-ui", "sans-serif"],
        mono: ["var(--mkt-label)", "ui-monospace", "monospace"],
      },
      colors: {
        brand: {
          50: "#fef2f2",
          100: "#fee2e2",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
          900: "#7f1d1d",
        },
        // Semantic palette, defined as RGB channels in globals.css:
        // ink = page background, paper = strongest text, ash = body text,
        // manila = rules/borders, tally = accent, signal = positive.
        mkt: {
          ink: "rgb(var(--mkt-ink) / <alpha-value>)",
          manila: "rgb(var(--mkt-manila) / <alpha-value>)",
          tally: "rgb(var(--mkt-tally) / <alpha-value>)",
          signal: "rgb(var(--mkt-signal) / <alpha-value>)",
          paper: "rgb(var(--mkt-paper) / <alpha-value>)",
          ash: "rgb(var(--mkt-ash) / <alpha-value>)",
          surface: "rgb(var(--mkt-surface) / <alpha-value>)",
          fail: "rgb(var(--mkt-fail) / <alpha-value>)",
        },
      },
      animation: {
        "float": "float 6s ease-in-out infinite",
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
