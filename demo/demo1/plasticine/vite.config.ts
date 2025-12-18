import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  root: __dirname,
  server: {
    port: 3001,
  },
  build: {
    target: 'esnext',
    outDir: '../dist/plasticine',
  },
});
