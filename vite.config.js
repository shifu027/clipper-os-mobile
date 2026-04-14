import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  // Automatically detect the base for local or GitHub Pages
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    open: true,
  },
  define: {
    __GEMINI_ENABLED__: JSON.stringify(process.env.VITE_GEMINI_ENABLED === 'true'),
  },
});
