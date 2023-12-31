import { resolve } from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, './index.html'),
        preview: resolve(__dirname, './preview.html'),
      },
      output: [
        {
          name: "index",
          dir: "dist",
        },
        {
          name: "preview",
          dir: "preview",
        },
      ]
    },
  },
})
