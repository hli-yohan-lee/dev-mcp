import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default {
  plugins: [
    react({
      babel: {
        presets: [
          ['@babel/preset-env', { 
            targets: { node: 'current' },
            modules: false
          }],
          '@babel/preset-react',
          '@babel/preset-typescript'
        ],
        plugins: [
          '@babel/plugin-transform-runtime'
        ]
      }
    })
  ],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:9000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom']
  },
  esbuild: {
    target: 'es2022',
    supported: {
      'top-level-await': true
    }
  },
  build: {
    target: 'es2022'
  }
} 