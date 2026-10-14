/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/paluwagan/',
  plugins: [react()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
