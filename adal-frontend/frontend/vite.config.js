import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig(() => {
  const isTest = Boolean(process.env.VITEST)

  return {
    plugins: [react()],
    resolve: {
      alias: isTest
        ? [
            // Avoid loading thousands of icon modules in tests (prevents EMFILE on Windows).
            {
              find: /^@mui\/icons-material\/.*$/,
              replacement: path.resolve(__dirname, 'src/tests/mocks/MuiIconStub.jsx'),
            },
          ]
        : [],
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './vitest.setup.js',
      // Reduce parallel file pressure to avoid EMFILE on Windows with large MUI import graphs.
      fileParallelism: false,
      poolOptions: {
        threads: {
          singleThread: true,
        },
      },
    },
  }
})
