import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Cosmic Editorial palette — deep space base + warm observer accent
        bg: {
          DEFAULT: "#05060a", // near-black page background
          raised: "#0a0c12", // panels
          overlay: "rgba(255,255,255,0.02)",
        },
        edge: {
          DEFAULT: "rgba(255,255,255,0.06)", // default border
          strong: "rgba(255,255,255,0.12)",
        },
        fg: {
          DEFAULT: "rgba(255,255,255,0.92)",
          muted: "rgba(255,255,255,0.5)",
          subtle: "rgba(255,255,255,0.3)",
        },
        // Functional accents — cool satellite track + warm observer pin
        satellite: "#9ec5ff",
        observer: "#ffb347",
        // Semantic
        danger: "#ff6b6b",
        success: "#6fcf97",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
        serif: ["Georgia", "Times New Roman", "serif"],
        mono: ["SF Mono", "Menlo", "Consolas", "monospace"],
      },
      fontSize: {
        // Tighter tracking for small-caps labels
        label: ["0.68rem", { letterSpacing: "0.18em" }],
      },
      borderRadius: {
        card: "12px",
        pill: "999px",
      },
      boxShadow: {
        halo: "0 0 40px rgba(158, 197, 255, 0.15)",
        glow: "0 0 12px rgba(158, 197, 255, 0.5)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
