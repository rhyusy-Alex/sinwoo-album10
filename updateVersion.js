import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname 설정 (ES Module에서는 직접 만들어야 함)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. 한국 시간(KST) 구하기
const now = new Date();
const kstOptions = {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
};

const formatter = new Intl.DateTimeFormat('ko-KR', kstOptions);
const parts = formatter.formatToParts(now);

const dateMap = {};
parts.forEach(({ type, value }) => { dateMap[type] = value; });
const formattedDate = `${dateMap.year}.${dateMap.month}.${dateMap.day} ${dateMap.hour}:${dateMap.minute}`;

// 2. JSON 내용 준비
const versionData = {
  version: "1.1.0",
  buildTime: formattedDate
};

// 3. 파일 저장
const filePath = path.join(__dirname, 'src', 'version.json');
fs.writeFileSync(filePath, JSON.stringify(versionData, null, 2));

console.log(`✅ Build time updated: ${formattedDate}`);