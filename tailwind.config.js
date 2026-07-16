/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ⭐ เพิ่มโค้ดส่วนนี้เข้าไป เพื่อบอกให้ Tailwind รู้จักฟอนต์ Prompt
      fontFamily: {
        sans: ['Prompt', 'sans-serif'], 
      },
    },
  },
  plugins: [],
}