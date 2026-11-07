import type { Config } from "tailwindcss";

// All colours, fonts and radii live here (and as CSS variables in app/globals.css)
// so the Figma restyle is a token swap, not a rewrite.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "rgb(var(--ink-950) / <alpha-value>)",
          900: "rgb(var(--ink-900) / <alpha-value>)",
          800: "rgb(var(--ink-800) / <alpha-value>)",
          700: "rgb(var(--ink-700) / <alpha-value>)",
          600: "rgb(var(--ink-600) / <alpha-value>)",
        },
        fg: {
          DEFAULT: "rgb(var(--fg) / <alpha-value>)",
          muted: "rgb(var(--fg-muted) / <alpha-value>)",
          subtle: "rgb(var(--fg-subtle) / <alpha-value>)",
        },
        pass: {
          DEFAULT: "rgb(var(--pass) / <alpha-value>)",
          soft: "rgb(var(--pass-soft) / <alpha-value>)",
          fg: "rgb(var(--pass-fg) / <alpha-value>)",
        },
        block: {
          DEFAULT: "rgb(var(--block) / <alpha-value>)",
          soft: "rgb(var(--block-soft) / <alpha-value>)",
          fg: "rgb(var(--block-fg) / <alpha-value>)",
        },
        wall: {
          DEFAULT: "rgb(var(--wall) / <alpha-value>)",
          soft: "rgb(var(--wall-soft) / <alpha-value>)",
        },
        work: {
          DEFAULT: "rgb(var(--work) / <alpha-value>)",
          soft: "rgb(var(--work-soft) / <alpha-value>)",
        },
        line: "rgb(var(--line) / <alpha-value>)",
        brand: "rgb(var(--brand) / <alpha-value>)",
        sky: { DEFAULT: "rgb(var(--sky) / <alpha-value>)" },
        sim: { DEFAULT: "rgb(var(--sim) / <alpha-value>)", soft: "rgb(var(--sim-soft) / <alpha-value>)" },
      },
      fontFamily: {
        display: ["var(--font-sans)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "var(--radius-card)",
        pill: "9999px",
        chip: "var(--radius-chip)",
      },
      keyframes: {
        pulseDot: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.35" } },
      },
      animation: { "pulse-dot": "pulseDot 1.6s ease-in-out infinite" },
    },
  },
  plugins: [],
};
export default config;
