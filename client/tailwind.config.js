/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#5B21B6",
          dark: "#4C1D95",
          light: "#7C3AED",
          soft: "#EDE9FE",
        },
      },
      keyframes: {
        "bounce-short": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },
      animation: {
        "bounce-short": "bounce-short 0.5s ease-out 1",
      },
    },
  },
  plugins: [],
}
