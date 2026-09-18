import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const ADMIN_UI_PORT = 5173;
const API_ORIGIN = 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  server: {
    port: ADMIN_UI_PORT,
    proxy: {
      '/api': { target: API_ORIGIN, changeOrigin: true },
      '/v1': { target: API_ORIGIN, changeOrigin: true },
    },
  },
});
