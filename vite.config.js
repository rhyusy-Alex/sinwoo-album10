import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 현재 날짜와 시간을 구해서 버전 문자열로 만듦 (예: v25.11.26 18:30)
const now = new Date();
const version = `v${now.getFullYear().toString().slice(2)}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
});