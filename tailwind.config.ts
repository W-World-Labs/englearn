import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          50: "#f8f7f3", 100: "#eeeee7", 200: "#dedfd5",
          300: "#c4c8ba", 400: "#959e8d", 500: "#687565",
          600: "#52604f", 700: "#414f40", 800: "#303d31", 900: "#233027",
        },
        brand: {
          50: "#edf5ef",
          100: "#d8eade",
          200: "#b5d6c0",
          300: "#85b99a",
          400: "#5a9875",
          500: "#397e5b",
          600: "#2b684b",
          700: "#23553e",
          800: "#1e4535",
          900: "#193a2d",
        },
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        card: "0 3px 14px -6px rgba(62, 54, 40, 0.12)",
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, #397e5b 0%, #5a9875 50%, #85b99a 100%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "score-float": {
          "0%": { transform: "translateY(0)", opacity: "1" },
          "100%": { transform: "translateY(-32px)", opacity: "0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.35s ease-out forwards",
        "score-float": "score-float 0.9s ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;