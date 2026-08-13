import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // three is the bulk of the bundle and changes only when the
    // dependency does. Splitting it off keeps the app chunk small enough
    // to re-download on its own, so a copy tweak does not cost the
    // visitor the renderer again.
    rollupOptions: {
      output: {
        // rolldown (Vite 8) takes only the function form here.
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three';
          if (id.includes('/node_modules/gsap/')) return 'motion';
          return null;
        },
      },
    },
  },
});
