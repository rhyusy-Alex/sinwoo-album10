import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 한국 시간(KST, UTC+9) 기준 버전 생성 로직
// 예: "v25.11.27 18:30"
const now = new Date();
const kstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000));
const version = `v${kstDate.getUTCFullYear().toString().slice(2)}.${(kstDate.getUTCMonth() + 1).toString().padStart(2, '0')}.${kstDate.getUTCDate().toString().padStart(2, '0')} ${kstDate.getUTCHours().toString().padStart(2, '0')}:${kstDate.getUTCMinutes().toString().padStart(2, '0')}`;

export default defineConfig({
  plugins: [react()],
  define: {
    // 앱 전체에서 __APP_VERSION__ 변수를 쓸 수 있게 주입
    __APP_VERSION__: JSON.stringify(version),
  },
  server: {
    hmr: {
      overlay: false, // 에러 오버레이 끄기 (선택사항)
    },
  },
});