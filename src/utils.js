// --- 버전 정보 ---
export const APP_VERSION = '1.1.0 (Refactored)';

// --- 상수 (점수 정책) ---
export const POINTS = { UPLOAD: 100, RX_COMMENT: 10, WR_COMMENT: 20, RX_HEART: 3, GV_HEART: 5, TAG_EDIT: 20 };

// --- 유틸리티 함수 ---

// 1. 태그 포맷팅 (숫자 뒤에 '기' 붙이기)
export const formatTag = (tag) => {
  if (!tag) return "";
  return /^\d+$/.test(tag) ? tag + '기' : tag;
};

// 2. 날짜 포맷팅 (★ 이 부분이 에러의 원인! 꼭 있어야 함)
export const formatDate = (timestamp) => {
  if (!timestamp || !timestamp.seconds) return '';
  try {
    const date = new Date(timestamp.seconds * 1000);
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
  } catch (e) { return ''; }
};

// 3. 태그 정렬기 (숫자 우선 정렬)
export const sortTagsSmart = (tags) => {
  if (!tags || !Array.isArray(tags)) return [];
  return [...tags].sort((a, b) => {
    const numA = parseInt(a.replace(/[^0-9]/g, ""), 10);
    const numB = parseInt(b.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    if (!isNaN(numA)) return -1;
    if (!isNaN(numB)) return 1;
    return a.localeCompare(b);
  });
};

// 4. 실시간 통계 계산
export const calculateRealtimeStats = (photos) => {
  const stats = {};
  if (!photos || !Array.isArray(photos)) return stats;
  photos.forEach(p => {
    const uid = p.uploaderId;
    if (uid) {
      if (!stats[uid]) stats[uid] = { upload: 0, rxHeart: 0, rxComment: 0 };
      stats[uid].upload += 1;
      stats[uid].rxHeart += ((p.likes || []).length);
      stats[uid].rxComment += (p.commentsCount || 0);
    }
  });
  return stats;
};

// 5. 유저 점수 계산
export const calculateUserScore = (userDoc, stats) => {
  if (!userDoc) return 0;
  const s = stats[userDoc.id] || { upload: 0, rxHeart: 0, rxComment: 0 };
  return (s.upload * POINTS.UPLOAD) + 
         (s.rxHeart * POINTS.RX_HEART) + 
         (s.rxComment * POINTS.RX_COMMENT) + 
         ((userDoc.commentCount || 0) * POINTS.WR_COMMENT) + 
         ((userDoc.givenHeartCount || 0) * POINTS.GV_HEART) +
         ((userDoc.tagEditCount || 0) * POINTS.TAG_EDIT);
};