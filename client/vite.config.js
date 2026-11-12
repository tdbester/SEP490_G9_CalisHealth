import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    // `dist/` là thư mục output của `vite build`. Nếu không ignore, watcher của
    // dev server sẽ theo dõi chính thư mục này và crash với EBUSY khi có tiến
    // trình build chạy song song (Windows khoá file .task/.wasm trong lúc ghi).
    watch: {
      ignored: ['**/dist/**', '**/target/**'],
    },
  },
})
