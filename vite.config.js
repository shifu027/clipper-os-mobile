import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      // These Capacitor plugins are native modules resolved at runtime by Capacitor
      external: ['@capacitor-community/calendar'],
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  define: {
    __GEMINI_ENABLED__: JSON.stringify(process.env.VITE_GEMINI_ENABLED === 'true'),
  },
});
