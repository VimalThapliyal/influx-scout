import type { Config } from "tailwindcss";

/** Design tokens live in src/app/globals.css as CSS variables. See DESIGN_SYSTEM.md. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        canvas: token("canvas"),
        surface: token("surface"),
        subtle: token("subtle"),
        line: { DEFAULT: token("line"), strong: token("line-strong") },
        fg: token("fg"),
        muted: token("muted"),
        faint: token("faint"),
        accent: {
          DEFAULT: token("accent"),
          hover: token("accent-hover"),
          soft: token("accent-soft"),
          fg: token("accent-fg"),
        },
        success: { DEFAULT: token("success"), soft: token("success-soft") },
        warn: { DEFAULT: token("warn"), soft: token("warn-soft") },
        danger: { DEFAULT: token("danger"), soft: token("danger-soft") },
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "6px",
        lg: "8px",
      },
      boxShadow: {
        pop: "0 4px 16px rgb(26 25 23 / 0.08), 0 0 0 1px rgb(26 25 23 / 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
