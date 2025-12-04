import React, { useState } from 'react';
import { PageLayout, ScrollContent, LoadingSpinner } from '../components/Layout';
import { Crown, LogOut, Camera, BookHeart, ChevronRight, RefreshCw } from 'lucide-react';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { calculateRealtimeStats, calculateUserScore, POINTS } from '../utils';

export default function MyPageTab({ userData, photos, members, collections, renameCollection, onOpenAlbum, onPhotoClick }) {
  if (!userData) return <LoadingSpinner msg="내 정보를 불러오는 중..." />;

  const [syncing, setSyncing] = useState(false);

  // 실시간 통계 (photos가 비어있으면 0이 나옴 -> 아래 DB값과 병합 사용)
  const stats = calculateRealtimeStats(photos || []);
  const myStats = stats[userData.id] || { upload: 0, rxHeart: 0, rxComment: 0 };
  
  // 점수 계산 (utils.js 수정본 덕분에 DB값도 참조함)
  const myTotalScore = calculateUserScore(userData, stats);
  
  const allScores = members.map(m => calculateUserScore(m, stats)).sort((a, b) => b - a);
  const myRank = allScores.indexOf(myTotalScore) + 1;
  const totalUsers = members.length || 1; 
  const topPercent = Math.ceil((myRank / totalUsers) * 100);
  
  // ★ [관리자 기능] 점수 강제 동기화 (잃어버린 점수 복구)
  const handleSyncScores = async () => {
    if (!confirm("모든 사진을 전수 조사하여 회원들의 점수(업로드, 받은하트, 받은댓글)를 DB에 기록하시겠습니까?\n(시간이 조금 걸릴 수 있습니다)")) return;
    
    setSyncing(true);
    try {
      // 1. 모든 사진 가져오기 (이때만 일시적으로 많이 읽음)
      const querySnapshot = await getDocs(collection(db, "photos"));
      const allPhotos = querySnapshot.docs.map(d => d.data());
      
      // 2. 통계 계산
      const newStats = {};
      allPhotos.forEach(p => {
        const uid = p.uploaderId;
        if (uid) {
          if (!newStats[uid]) newStats[uid] = { upload: 0, rxHeart: 0, rxComment: 0 };
          newStats[uid].upload += 1;
          newStats[uid].rxHeart += ((p.likes || []).length);
          newStats[uid].rxComment += (p.commentsCount || 0);
        }
      });

      // 3. 각 유저 DB 업데이트
      const updatePromises = Object.keys(newStats).map(uid => {
        return updateDoc(doc(db, "users", uid), {
          uploadCount: newStats[uid].upload,
          rxHeartCount: newStats[uid].rxHeart,   // 받은 하트 저장
          rxCommentCount: newStats[uid].rxComment // 받은 댓글 저장
        });
      });
      
      await Promise.all(updatePromises);
      alert("동기화 완료! 모든 회원의 점수가 복구되었습니다. 🎉");
      window.location.reload(); // 새로고침하여 반영
      
    } catch (e) {
      console.error(e);
      alert("동기화 실패: " + e.message);
    }
    setSyncing(false);
  };

  return (
    <PageLayout>
      <ScrollContent type="form">
        <div className="flex flex-col items-center pt-10 pb-8 border-b border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-blue-50 to-white -z-10"></div>
          <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-blue-50 rounded-full mb-4 flex items-center justify-center text-4xl shadow-inner border-4 border-white">😎</div>
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-gray-900">{userData.name}</h2>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${userData.role === 'admin' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{userData.role === 'admin' ? '관리자' : `${userData.gisu}기`}</span>
            </div>
            <p className="text-sm text-gray-400 mt-1">{userData.email}</p>
          </div>
          <div className="mt-6 w-full max-w-xs bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-2xl p-4 shadow-sm flex flex-col items-center justify-center">
            <div className="flex items-center gap-2 text-yellow-700 font-bold text-sm mb-1"><Crown size={16}/> 현재 랭킹</div>
            <div className="text-3xl font-extrabold text-yellow-800 mb-1">{myRank}위 <span className="text-sm font-normal text-yellow-600">/ {totalUsers}명</span></div>
            <div className="text-xs text-yellow-600 font-medium bg-white/60 px-2 py-1 rounded-full">상위 {topPercent}% • 총점 {myTotalScore}점</div>
          </div>
          
          <div className="flex gap-2 mt-6">
            <button onClick={() => confirm("로그아웃 하시겠습니까?") && signOut(auth)} className="text-xs text-gray-400 border border-gray-200 px-4 py-1.5 rounded-full flex items-center gap-1 hover:bg-gray-50 transition-colors">
              <LogOut size={12}/> 로그아웃
            </button>
            
            {/* ★ 관리자 전용 동기화 버튼 */}
            {userData.role === 'admin' && (
              <button onClick={handleSyncScores} disabled={syncing} className="text-xs text-blue-600 border border-blue-200 bg-blue-50 px-4 py-1.5 rounded-full flex items-center gap-1 hover:bg-blue-100 transition-colors">
                {syncing ? <LoadingSpinner msg=""/> : <><RefreshCw size={12}/> 점수 복구(동기화)</>}
              </button>
            )}
          </div>
        </div>

        <div className="px-4 mt-6">
          <h3 className="font-bold text-gray-800 mb-3 text-sm">나의 성과</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 p-3 rounded-xl text-center border border-blue-100"><p className="text-xs text-blue-500 font-bold mb-1">📸 올린사진</p><p className="font-bold text-lg text-blue-900">{(userData.uploadCount||0)*POINTS.UPLOAD}점</p><p className="text-[10px] text-blue-400">({userData.uploadCount||0}장)</p></div>
            <div className="bg-blue-50 p-3 rounded-xl text-center border border-blue-100"><p className="text-xs text-blue-500 font-bold mb-1">💬 받은댓글</p><p className="font-bold text-lg text-blue-900">{(userData.rxCommentCount||0)*POINTS.RX_COMMENT}점</p><p className="text-[10px] text-blue-400">({userData.rxCommentCount||0}개)</p></div>
            <div className="bg-blue-50 p-3 rounded-xl text-center border border-blue-100"><p className="text-xs text-blue-500 font-bold mb-1">❤️ 받은하트</p><p className="font-bold text-lg text-blue-900">{(userData.rxHeartCount||0)*POINTS.RX_HEART}점</p><p className="text-[10px] text-blue-400">({userData.rxHeartCount||0}개)</p></div>
          </div>

          <h3 className="font-bold text-gray-800 mb-3 text-sm mt-5">참여 활동</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 p-3 rounded-xl text-center border border-gray-200"><p className="text-xs text-gray-500 font-bold mb-1">🏷️ 태그기여</p><p className="font-bold text-lg text-gray-700">{(userData.tagEditCount||0)*POINTS.TAG_EDIT}점</p><p className="text-[10px] text-gray-400">({userData.tagEditCount||0}회)</p></div>
            <div className="bg-gray-50 p-3 rounded-xl text-center border border-gray-200"><p className="text-xs text-gray-500 font-bold mb-1">✍️ 보낸댓글</p><p className="font-bold text-lg text-gray-700">{(userData.commentCount||0)*POINTS.WR_COMMENT}점</p><p className="text-[10px] text-gray-400">({userData.commentCount||0}개)</p></div>
            <div className="bg-gray-50 p-3 rounded-xl text-center border border-gray-200"><p className="text-xs text-gray-500 font-bold mb-1">🤍 보낸하트</p><p className="font-bold text-lg text-gray-700">{(userData.givenHeartCount||0)*POINTS.GV_HEART}점</p><p className="text-[10px] text-gray-400">({userData.givenHeartCount||0}개)</p></div>
          </div>
        </div>

        <div className="p-4 mt-4 mb-8">
          <button onClick={() => onOpenAlbum(null)} className="w-full py-4 bg-white border-2 border-gray-100 text-gray-600 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 hover:border-gray-200 transition-all shadow-sm">
            <BookHeart size={20} className="text-red-400"/> 나의 앨범 관리하러 가기 <ChevronRight size={16} className="text-gray-400"/>
          </button>
        </div>
      </ScrollContent>
    </PageLayout>
  );
}