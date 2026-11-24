import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// Pilot-only Vite config: real app CSS + real components, Inertia replaced by a
// minimal shim, no Laravel server and no new dependencies.
export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    alias: { '@inertiajs/react': path.resolve('pilot/inertia-shim.tsx') },
  },
  build: {
    rollupOptions: { input: path.resolve('pilot/index.html') },
    outDir: 'pilot-dist',
    emptyOutDir: true,
  },
});
