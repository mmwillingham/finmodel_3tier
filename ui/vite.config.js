import { defineConfig, loadEnv } from 'vite'; // Added loadEnv here
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.REACT_APP_API_URL || env.VITE_API_URL || 'http://localhost:8000'
  
  return {
    plugins: [react()],
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    build: {
      outDir: 'build',
      sourcemap: false,
      manifest: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            // This safely groups all node_modules into a single vendor chunk
            // without needing to guess package names like @mui/emotion
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
    publicDir: 'public',
    define: {
      'process.env.REACT_APP_API_URL': JSON.stringify(apiUrl),
      'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
    },
  }
})