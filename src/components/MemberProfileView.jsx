import React, { useMemo, useState, useEffect } from 'react';
import { ArrowLeft, Crown, Camera, MessageCircle, Heart, FolderPlus, Tag, PenTool, ThumbsUp } from 'lucide-react';
import { ScrollContent, LoadingSpinner } from './Layout';
import { calculateRealtimeStats, POINTS } from '../utils';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore'; // orderBy 제거됨

export default function MemberProfileView({ member, photos, onClose, onPhotoClick }) {
  if (!member) return null;

  const [fetchedPhotos, setFetchedPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  // ★ [수정됨] 정렬 조건(orderBy)을 쿼리에서 빼고, 자바스크립트로 정렬 (인덱스 에러 방지)
  useEffect(() => {
    const fetchMemberPhotos = async () => {
      setLoading(true);
      try {
        // 1. 조건: 이 사람이 올린 것만 (정렬은 뺌)
        const q = query(
          collection(db, 'photos'),
          where('uploaderId', '==', member.id)
        );
        
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // 2. 여기서 정렬 수행 (최신순)
        list.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        
        setFetchedPhotos(list);
      } catch (e) {
        console.error("프로필 사진 로딩 실패:", e);
      }
      setLoading(false);
    };

    fetchMemberPhotos();
  }, [member.id]);

  // 점수 계산 (DB값 우선)
  const count = {
    upload: member.uploadCount || 0,
    rxHeart: member.rxHeartCount || 0,
    rxComment: member.rxCommentCount || 0,
    wrComment: member.commentCount || 0,
    gvHeart: member.givenHeartCount || 0,
    tagEdit: member.tagEditCount || 0
  };
  
  const scoreBreakdown = {
    upload: count.upload * POINTS.UPLOAD,
    rxComment: count.rxComment * POINTS.RX_COMMENT,
    rxHeart: count.rxHeart * POINTS.RX_HEART,
    wrComment: count.wrComment * POINTS.WR_COMMENT,
    gvHeart: count.gvHeart * POINTS.GV_HEART,
    tagEdit: count.tagEdit * POINTS.TAG_EDIT,
  };

  const totalScore = Object.values(scoreBreakdown).reduce((a, b) => a + b, 0);

  // 활동 카드 컴포넌트
  const StatCard = ({ icon, label, count, score, colorClass }) => (
    <div className="bg-white p-3 rounded-xl text-center border shadow-sm flex flex-col items-center justify-center min-h-[90px]">
      <div className={`mb-1 ${colorClass}`}>{icon}</div>
      <p className="text-xs text-gray-400 font-medium mb-0.5">{label}</p>
      <div className="flex items-baseline gap-1 justify-center">
        <span className="font-bold text-gray-800 text-lg">{count}</span>
        {score > 0 && <span className="text-[10px] text-blue-500 font-bold">(+{score})</span>}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full bg-white">
      {/* 상단 헤더 */}
      <div className="bg-white p-3 sticky top-0 z-20 shadow-sm flex items-center gap-2 shrink-0 border-b">
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
          <ArrowLeft size={24} className="text-gray-700" />
        </button>
        <span className="font-bold text-lg text-blue-900 truncate">
          {member.name}님의 기록
        </span>
      </div>

      <ScrollContent type="list">
        {/* 1. 프로필 요약 카드 */}
        <div className="bg-gray-50 pb-8 pt-6 rounded-b-3xl border-b border-gray-200 shadow-sm mb-6">
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 bg-white border-4 border-white shadow-md rounded-full mb-3 flex items-center justify-center text-3xl">
              👤
            </div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-2xl font-bold text-gray-900">{member.name}</h2>
              <span className="text-sm text-gray-500 font-medium">{member.gisu}기</span>
              {member.role === 'admin' && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">관리자</span>
              )}
            </div>
            
            <div className="mt-4 bg-white border border-blue-100 px-6 py-2 rounded-full shadow-sm flex items-center gap-2 animate-bounce">
              <Crown size={16} className="text-yellow-500 fill-yellow-500"/>
              <span className="font-bold text-blue-900 text-lg">{totalScore}점</span>
            </div>
          </div>

          {/* 활동 상세 스탯 */}
          <div className="grid grid-cols-3 gap-2 px-4 mt-6">
            <StatCard icon={<Camera size={18}/>} label="사진 업로드" count={`${count.upload}장`} score={scoreBreakdown.upload} colorClass="text-blue-500"/>
            <StatCard icon={<MessageCircle size={18}/>} label="받은 댓글" count={`${count.rxComment}개`} score={scoreBreakdown.rxComment} colorClass="text-green-500"/>
            <StatCard icon={<Heart size={18}/>} label="받은 하트" count={`${count.rxHeart}개`} score={scoreBreakdown.rxHeart} colorClass="text-red-500"/>
            <StatCard icon={<Tag size={18}/>} label="태그 기여" count={`${count.tagEdit || 0}회`} score={scoreBreakdown.tagEdit} colorClass="text-orange-500"/>
            <StatCard icon={<PenTool size={18}/>} label="작성 댓글" count={`${count.wrComment || 0}회`} score={scoreBreakdown.wrComment} colorClass="text-purple-500"/>
            <StatCard icon={<ThumbsUp size={18}/>} label="보낸 하트" count={`${count.gvHeart || 0}회`} score={scoreBreakdown.gvHeart} colorClass="text-pink-400"/>
          </div>
        </div>

        {/* 2. 갤러리 섹션 */}
        <div className="px-4 mb-3 flex items-center gap-2">
          <FolderPlus size={18} className="text-blue-600"/>
          <h3 className="font-bold text-gray-800 text-sm">
            {member.name}님이 올린 추억 ({fetchedPhotos.length})
          </h3>
        </div>

        {loading ? <LoadingSpinner msg="추억을 불러오는 중..." /> : (
          fetchedPhotos.length === 0 ? (
            <div className="py-20 text-center text-gray-400 text-sm bg-gray-50 mx-4 rounded-xl border border-dashed">
              아직 올린 사진이 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-0.5">
              {fetchedPhotos.map((p) => (
                <div key={p.id} onClick={() => onPhotoClick(p)} className="aspect-square relative cursor-pointer group">
                  <img src={p.url} className="w-full h-full object-cover" loading="lazy" alt="user gallery" />
                  
                  {p.commentsCount > 0 && (
                    <div className="absolute top-1 right-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                      <MessageCircle size={10} /> {p.commentsCount}
                    </div>
                  )}

                  {p.photoYear && (
                    <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[10px] px-1.5 rounded backdrop-blur-sm">
                      {p.photoYear}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </ScrollContent>
    </div>
  );
}