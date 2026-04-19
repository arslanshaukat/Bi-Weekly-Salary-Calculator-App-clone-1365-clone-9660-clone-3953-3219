import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Removed alias configuration causing ESM __dirname error
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    historyApiFallback: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
});