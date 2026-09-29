import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/codera-learning-os/',
  plugins: [react()],
});
