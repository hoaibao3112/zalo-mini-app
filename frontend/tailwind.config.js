/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./app.ts",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      },
      colors: {
        brand: {
          primary: '#FF6B00',
          coffee: '#5F3D2E',       // Roasted Coffee Brown
          coffeeLight: '#8D6E63',  // Light coffee brown
          coffeeGold: '#C89C76',   // Golden warm coffee
          dark: '#1C1917',         // Neutral dark
          cream: '#FDFBF7',        // Creamy beige background
          soft: '#FFFFFF',
          gray: '#F5F5F5',
          light: '#FFF0E6'         // Tinted orange for soft backgrounds
        }
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'float': '0 10px 40px -10px rgba(255, 107, 0, 0.25)',
      }
    },
  },
  plugins: [],
}
