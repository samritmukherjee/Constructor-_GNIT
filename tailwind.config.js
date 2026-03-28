/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#22C55E', // Green-500
          dark: '#16A34A',    // Green-600
          light: '#86EFAC',   // Green-300
        },
      },
    },
  },
  plugins: [],
}
