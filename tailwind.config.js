/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  safelist: [
    // Clip status dynamic colors (used as template literals in getClipperHTML)
    'border-slate-500', 'bg-slate-50', 'text-slate-600', 'border-slate-100',
    'border-amber-500', 'bg-amber-50', 'text-amber-600', 'border-amber-100',
    'border-green-500', 'bg-green-50', 'text-green-600', 'border-green-100',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
