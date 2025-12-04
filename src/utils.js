import versionData from './version.json';

// --- 버전 정보 (자동화됨) ---
export const APP_VERSION = `Ver ${versionData.version} (${versionData.buildTime})`;

// --- 상수 (점수 정책) ---
export const POINTS = { UPLOAD: 100, RX_COMMENT: 10, WR_COMMENT: 20, RX_HEART: 3, GV_HEART: 5, TAG_EDIT: 20 };

// --- 유틸리티 함수 ---

// 1. 태그 포맷팅 (숫자 뒤에 '기' 붙이기)
export const formatTag = (tag) => {
  if (!tag) return "";
  return /^\d+$/.test(tag) ? tag + '기' : tag;
};

// 2. 날짜 포맷팅
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

// 4. 실시간 통계 계산 (프로필 상세 등에서 사용)
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

// 5. 유저 점수 계산 (DB 최적화 버전: DB값을 우선 사용)
export const calculateUserScore = (userDoc, stats) => {
  if (!userDoc) return 0;
  
  // stats(사진 집계)가 있으면 쓰고, 없으면 userDoc(DB 저장값)을 사용
  // 무한 스크롤 적용 후에는 stats가 부분적일 수 있으므로 userDoc 값이 더 정확함
  const upload = userDoc.uploadCount || stats?.[userDoc.id]?.upload || 0;
  const rxHeart = userDoc.rxHeartCount || stats?.[userDoc.id]?.rxHeart || 0;
  const rxComment = userDoc.rxCommentCount || stats?.[userDoc.id]?.rxComment || 0;
  
  const wrComment = userDoc.commentCount || 0;
  const gvHeart = userDoc.givenHeartCount || 0;
  const tagEdit = userDoc.tagEditCount || 0;

  return (upload * POINTS.UPLOAD) + 
         (rxHeart * POINTS.RX_HEART) + 
         (rxComment * POINTS.RX_COMMENT) + 
         (wrComment * POINTS.WR_COMMENT) + 
         (gvHeart * POINTS.GV_HEART) +
         (tagEdit * POINTS.TAG_EDIT);
};