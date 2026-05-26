/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        reef: {
          navy: "#050d1a",
          deep: "#0a1628",
          teal: "#0d9488",
          coral: "#fb7185",
          anemone: "#f97316",
          lavender: "#c4b5fd",
          sand: "#fef9c3",
        },
      },
      fontFamily: {
        mono: ["'Courier New'", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float-up": "floatUp 6s ease-in infinite",
        "caustic": "caustic 8s ease-in-out infinite alternate",
      },
      keyframes: {
        floatUp: {
          "0%": { transform: "translateY(0) scale(1)", opacity: "0.7" },
          "100%": { transform: "translateY(-100vh) scale(0.5)", opacity: "0" },
        },
        caustic: {
          "0%": { transform: "skewX(-3deg) translateX(-5px)", opacity: "0.08" },
          "100%": { transform: "skewX(3deg) translateX(5px)", opacity: "0.18" },
        },
      },
    },
  },
  plugins: [],
};
