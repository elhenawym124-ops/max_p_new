import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Path resolution
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/components': resolve(__dirname, './src/components'),
      '@/pages': resolve(__dirname, './src/pages'),
      '@/hooks': resolve(__dirname, './src/hooks'),
      '@/services': resolve(__dirname, './src/services'),
      '@/utils': resolve(__dirname, './src/utils'),
      '@/types': resolve(__dirname, './src/types'),
      '@/styles': resolve(__dirname, './src/styles'),
      '@/assets': resolve(__dirname, './src/assets'),
      '@shared': resolve(__dirname, '../shared'),
    },
  },

  // Development server configuration
  server: {
    port: 3000,
    host: true,
    open: false, // تم تعطيل فتح المتصفح تلقائياً لتجنب المشاكل
    cors: true,
    strictPort: true, // فشل إذا كان المنفذ مُستخدم بدلاً من البحث عن منفذ آخر
    proxy: {
      '/api': {
        target: 'http://localhost:3007',
        changeOrigin: true,
        secure: false,
      },
      '/webhooks': {
        target: 'http://localhost:3007',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:3007',
        changeOrigin: true,
        ws: true,
      },
    },
  },

  // Build configuration
  build: {
    outDir: 'dist',
    sourcemap: false, // Disable sourcemaps in production to save memory
    minify: 'esbuild', // Use esbuild instead of terser (faster, less memory)
    target: 'es2020',
    // Increase chunk size limit
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // More aggressive chunking to reduce memory usage
          if (id.includes('node_modules')) {
            // React core
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            // Router
            if (id.includes('react-router')) {
              return 'vendor-router';
            }
            // UI libraries
            if (id.includes('@headlessui') || id.includes('@heroicons') || id.includes('@mui')) {
              return 'vendor-ui';
            }
            // Charts
            if (id.includes('chart.js') || id.includes('recharts')) {
              return 'vendor-charts';
            }
            // Utilities
            if (id.includes('lodash') || id.includes('date-fns') || id.includes('axios')) {
              return 'vendor-utils';
            }
            // Large libraries
            if (id.includes('framer-motion') || id.includes('@craftjs')) {
              return 'vendor-animation';
            }
            // Everything else from node_modules
            return 'vendor-other';
          }
        },
      },
    },
  },

  // Preview configuration
  preview: {
    port: 3000,
    host: true,
    cors: true,
  },

  // Environment variables
  envPrefix: 'REACT_APP_',

  // CSS configuration
  css: {
    devSourcemap: true,
    modules: {
      localsConvention: 'camelCase',
    },
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@/styles/variables.scss";`,
      },
    },
  },

  // Optimization
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'react-query',
      'axios',
      'socket.io-client',
      'chart.js',
      'date-fns',
      'lodash',
    ],
  },

  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },

  // Test configuration
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
});
