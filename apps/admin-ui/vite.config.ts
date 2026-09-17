import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const ADMIN_UI_PORT = 5173;
const API_ORIGIN = 'http://localhost:3000';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../../', '');

  return {
    plugins: [react(), tailwindcss(), tsconfigPaths()],
    server: {
      port: ADMIN_UI_PORT,
      proxy: {
        '/api': {
          target: API_ORIGIN,
          changeOrigin: true,
          headers: { authorization: `Bearer ${env.PINSTRIPE_ADMIN_API_KEY ?? ''}` },
        },
        '/v1': {
          target: API_ORIGIN,
          changeOrigin: true,
          headers: { authorization: `Bearer ${env.PINSTRIPE_SECRET_API_KEY ?? ''}` },
        },
      },
    },
  };
});
