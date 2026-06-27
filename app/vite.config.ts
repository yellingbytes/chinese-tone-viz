import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' keeps asset URLs relative so the same build works under a GitHub
// Pages subpath (/chinese-tone-viz/) and inside a Capacitor WebView (file://).
export default defineConfig({
  base: './',
  plugins: [react()],
});
