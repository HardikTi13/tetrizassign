import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true, // Needed for docker container port mapping
    watch: {
      usePolling: true // Ensure hot reloading works inside Docker volumes
    }
  }
});
