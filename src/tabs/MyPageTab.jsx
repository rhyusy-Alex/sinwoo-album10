import React from 'react';
import { PageLayout, ScrollContent, LoadingSpinner } from '../components/Layout';
import { Crown, LogOut, Camera, BookHeart, ChevronRight } from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { calculateRealtimeStats, calculateUserScore, POINTS } from '../utils';

export default function MyPageTab({ userData, photos, members, collections, renameCollection, onOpenAlbum, onPhotoClick }) {
  if (!userData) return <LoadingSpinner msg="내 정보를 불러오는 중..." />;

  const stats = calculateRealtimeStats(photos || []);
  const myStats = stats[userData.id] || { upload: 0, rxHeart: 0, rxComment: 0 };
  const myTotalScore = calculateUserScore(userData, stats);
  
  const allScores = members.map(m => calculateUserScore(m, stats)).sort((a, b) => b - a);
  const myRank = allScores.indexOf(myTotalScore) + 1;
  const totalUsers = members.length || 1; 
  const topPercent = Math.ceil((myRank / totalUsers) * 100);
  
  const myUploads = (photos || []).filter(p => p.uploaderId === userData.id).sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
  const recentPhotos = myUploads.slice(0, 5);

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
          <button onClick={() => confirm("로그아웃 하시겠습니까?") && signOut(auth)} className="mt-6 text-xs text-gray-400 border border-gray-200 px-4 py-1.5 rounded-full flex items-center gap-1 hover:bg-gray-50 transition-colors">
            <LogOut size={12}/> 로그아웃
          </button>
        </div>

        <div className="px-4 mt-6">
          <h3 className="font-bold text-gray-800 mb-3 text-sm">나의 성과</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 p-3 rounded-xl text-center border border-blue-100"><p className="text-xs text-blue-500 font-bold mb-1">📸 올린사진</p><p className="font-bold text-lg text-blue-900">{(myStats.upload||0)*POINTS.UPLOAD}점</p><p className="text-[10px] text-blue-400">({myStats.upload||0}장)</p></div>
            <div className="bg-blue-50 p-3 rounded-xl text-center border border-blue-100"><p className="text-xs text-blue-500 font-bold mb-1">💬 받은댓글</p><p className="font-bold text-lg text-blue-900">{(myStats.rxComment||0)*POINTS.RX_COMMENT}점</p><p className="text-[10px] text-blue-400">({myStats.rxComment||0}개)</p></div>
            <div className="bg-blue-50 p-3 rounded-xl text-center border border-blue-100"><p className="text-xs text-blue-500 font-bold mb-1">❤️ 받은하트</p><p className="font-bold text-lg text-blue-900">{(myStats.rxHeart||0)*POINTS.RX_HEART}점</p><p className="text-[10px] text-blue-400">({myStats.rxHeart||0}개)</p></div>
          </div>

          <h3 className="font-bold text-gray-800 mb-3 text-sm mt-5">참여 활동</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 p-3 rounded-xl text-center border border-gray-200"><p className="text-xs text-gray-500 font-bold mb-1">🏷️ 태그기여</p><p className="font-bold text-lg text-gray-700">{(userData.tagEditCount||0)*POINTS.TAG_EDIT}점</p><p className="text-[10px] text-gray-400">({userData.tagEditCount||0}회)</p></div>
            <div className="bg-gray-50 p-3 rounded-xl text-center border border-gray-200"><p className="text-xs text-gray-500 font-bold mb-1">✍️ 보낸댓글</p><p className="font-bold text-lg text-gray-700">{(userData.commentCount||0)*POINTS.WR_COMMENT}점</p><p className="text-[10px] text-gray-400">({userData.commentCount||0}개)</p></div>
            <div className="bg-gray-50 p-3 rounded-xl text-center border border-gray-200"><p className="text-xs text-gray-500 font-bold mb-1">🤍 보낸하트</p><p className="font-bold text-lg text-gray-700">{(userData.givenHeartCount||0)*POINTS.GV_HEART}점</p><p className="text-[10px] text-gray-400">({userData.givenHeartCount||0}개)</p></div>
          </div>
        </div>

        <div className="mt-8 px-4">
          <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2"><Camera size={20} className="text-purple-500"/> 최근 올린 추억</h3>
          {recentPhotos.length === 0 ? ( 
            <div className="bg-gray-50 rounded-xl p-6 text-center border border-dashed border-gray-300"><p className="text-gray-400 text-sm">아직 올린 사진이 없습니다.<br/>첫 사진을 올리고 100점을 받아보세요!</p></div> 
          ) : ( 
            <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
              {recentPhotos.map(p => { 
                const hasNewComment = p.lastCommentAt && (Date.now() - p.lastCommentAt.toDate().getTime() < 24 * 60 * 60 * 1000); 
                return (
                  <div key={p.id} onClick={() => onPhotoClick(p)} className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden relative cursor-pointer border border-gray-200 shadow-sm">
                    <img src={p.url} className="w-full h-full object-cover" alt="recent" />
                    {hasNewComment && <div className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse shadow-sm"></div>}
                  </div>
                ); 
              })}
            </div> 
          )}
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