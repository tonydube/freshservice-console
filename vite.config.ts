/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  // Vite doesn't put .env values into process.env for its own config, so load them explicitly
  // (prefix '' = all vars, not just VITE_*). A real environment variable still wins over .env,
  // matching how the server (dotenv) resolves it. Nothing here is exposed to the browser bundle.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const serverPort = Number(env.SERVER_PORT || 8787);

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: { '/api': `http://127.0.0.1:${serverPort}` },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
    },
  };
});
