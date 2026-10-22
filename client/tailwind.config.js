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
    },
  },
  plugins: [],
}
