/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        ui: ["var(--font-ui)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        brand: {
          DEFAULT: "#22d3ee",
          strong: "#3b82f6",
          deep: "#0f172a",
          magenta: "#a855f7",
        },
        surface: {
          1: "rgba(14, 20, 36, 0.72)",
          2: "rgba(19, 27, 47, 0.82)",
          3: "rgba(26, 36, 60, 0.9)",
          solid: "#0d1424",
        },
        border: {
          glass: "rgba(255, 255, 255, 0.07)",
          brand: "rgba(34, 211, 238, 0.42)",
        },
      },
      animation: {
        "aurora": "aurora-drift 18s ease-in-out infinite alternate",
        "spin-slow": "spin 3s linear infinite",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float1 22s ease-in-out infinite alternate",
      },
      keyframes: {
        "aurora-drift": {
          "0%": { transform: "translate(0, 0) scale(1)" },
          "100%": { transform: "translate(30px, -50px) scale(1.08)" },
        },
        "float1": {
          "0%": { transform: "translate3d(0, 0, 0) scale(1)" },
          "100%": { transform: "translate3d(-70px, 60px, 0) scale(1.12)" },
        },
      },
      typography: {
        DEFAULT: {
          css: {
            color: "#e8eefc",
            a: { color: "#67e8f9", textDecoration: "none", "&:hover": { color: "#22d3ee" } },
          },
        },
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
  ],
};
