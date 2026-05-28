import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: './',
  base: './',
  plugins: [react()],
  css: {
    postcss: './postcss.config.js',
  },
  server: {
    port: 3000,
  },
  build: {
    outDir: 'www',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            if (id.includes('zmp-sdk') || id.includes('zmp-ui')) {
              return 'vendor-zmp';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-ui';
            }
            return 'vendor-others';
          }
        }
      }
    }
  },
});
