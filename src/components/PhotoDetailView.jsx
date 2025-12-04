import React, { useState } from 'react';
import { ArrowLeft, Share2, FolderX, Trash2, Maximize2, Edit2, Calendar, Eye, Plus, Heart, FolderPlus } from 'lucide-react';
import { db, storage, auth } from '../firebase';
import { doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { ScrollContent } from './Layout';
import { formatTag, sortTagsSmart, POINTS } from '../utils';
import CommentSection from './CommentSection';
import TagEditModal from './TagEditModal';

export default function PhotoDetailView({ photo, onClose, activeAlbumId, toggleCollectionItem, openSaveModal, showToast }) {
  const [editingTags, setEditingTags] = useState(false);
  const currentUser = auth.currentUser;
  
  // 권한 체크
  const isMyPost = currentUser && photo.uploaderId === currentUser.uid;
  const isLiked = (photo.likes || []).includes(currentUser?.uid);
  const displayTags = sortTagsSmart(photo.tags || []);

  // --- 내부 핸들러 함수들 ---
  
  const handleLike = async () => {
    if (!currentUser) return;
    const photoRef = doc(db, 'photos', photo.id);
    const userRef = doc(db, 'users', currentUser.uid); // 나 (보낸 사람)
    
    // ★ [중요] 사진 주인 (받은 사람) 참조
    const authorRef = photo.uploaderId ? doc(db, 'users', photo.uploaderId) : null;
    
    try {
      if (isLiked) {
        // 좋아요 취소
        await updateDoc(photoRef, { likes: arrayRemove(currentUser.uid) });
        await updateDoc(userRef, { givenHeartCount: increment(-1) });
        if (authorRef) await updateDoc(authorRef, { rxHeartCount: increment(-1) }); // 받은 사람 점수 차감
      } else {
        // 좋아요
        await updateDoc(photoRef, { likes: arrayUnion(currentUser.uid) });
        await updateDoc(userRef, { givenHeartCount: increment(1) });
        if (authorRef) await updateDoc(authorRef, { rxHeartCount: increment(1) }); // 받은 사람 점수 증가
      }
    } catch (e) { console.error(e); }
  };

  const handleUpdateDesc = async () => {
    if (!isMyPost) return;
    const newDesc = prompt('사진 설명을 수정해주세요:', photo.desc);
    if (newDesc !== null && newDesc !== photo.desc) {
      try {
        await updateDoc(doc(db, 'photos', photo.id), { desc: newDesc });
        if(showToast) showToast('수정 완료!');
      } catch (e) { alert(e.message); }
    }
  };

  const handleUpdateYear = async () => {
    const newYear = prompt('촬영 연도(4자리) 입력', photo.photoYear || '');
    if (newYear !== null && newYear !== photo.photoYear) {
      if (!/^\d{4}$/.test(newYear) && newYear !== '') { alert('4자리 숫자로 입력해주세요'); return; }
      try {
        await updateDoc(doc(db, 'photos', photo.id), { photoYear: newYear });
        if(showToast) showToast('연도 저장 완료!');
      } catch (e) { alert(e.message); }
    }
  };

  const handleDelete = async () => {
    if (!confirm('정말로 삭제하시겠습니까?')) return;
    onClose(); 
    try {
      await deleteObject(ref(storage, photo.url)).catch((e) => console.log(e));
      await deleteDoc(doc(db, 'photos', photo.id));
      if (photo.uploaderId) {
        // 삭제 시 점수도 회수
        await updateDoc(doc(db, 'users', photo.uploaderId), { uploadCount: increment(-1) });
      }
      if(showToast) showToast('삭제되었습니다.');
    } catch (e) { alert(e.message); }
  };

  const handleTagSave = async (targetPhoto, newTags) => {
    const sortedTags = sortTagsSmart(newTags);
    const oldTags = sortTagsSmart(targetPhoto.tags || []);
    
    if (JSON.stringify(sortedTags) === JSON.stringify(oldTags)) { 
        setEditingTags(false); 
        return; 
    }
    
    setEditingTags(false);
    try {
      await updateDoc(doc(db, 'photos', targetPhoto.id), { tags: sortedTags });
      await updateDoc(doc(db, 'users', currentUser.uid), { tagEditCount: increment(1) });
      if(showToast) showToast(`태그 저장 완료! (+${POINTS.TAG_EDIT}점)`);
    } catch (e) { alert(e.message); }
  };

  const handleShare = async () => {
    const shareData = { title: '신우 Photo', text: `[신우 Photo] ${photo.desc}`, url: `${window.location.origin}/?photoId=${photo.id}` };
    try { 
        if (navigator.share) await navigator.share(shareData); 
        else { await navigator.clipboard.writeText(shareData.url); if(showToast) showToast("링크 복사 완료!"); } 
    } catch (e) { console.log('Share closed'); }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white">
      {/* 상단 헤더 */}
      <div className="p-3 border-b flex items-center justify-between sticky top-0 bg-white z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft size={24} className="text-gray-700" /></button>
          <span className="font-bold text-lg truncate">사진 상세</span>
        </div>
        <div className="flex gap-2">
          <button onClick={handleShare} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"><Share2 size={20} /></button>
          {activeAlbumId && (
            <button onClick={async () => { if (confirm("현재 앨범에서 이 사진을 뺄까요?")) { await toggleCollectionItem(activeAlbumId, photo.id); onClose(); } }} className="p-2 text-orange-500 hover:bg-orange-50 rounded-full" title="앨범에서 제외"><FolderX size={20} /></button>
          )}
          {(isMyPost) && (
            <button onClick={handleDelete} className="p-2 text-red-500 hover:bg-red-50 rounded-full"><Trash2 size={20} /></button>
          )}
        </div>
      </div>

      <ScrollContent type="list" className="relative">
        <div className="w-full bg-black flex items-center justify-center relative group">
          <img src={photo.url} className="w-full h-auto max-h-[60vh] object-contain" alt="detail" />
          <button onClick={(e) => { e.stopPropagation(); window.open(photo.url, '_blank'); }} className="absolute bottom-3 right-3 bg-white/20 hover:bg-white/40 text-white backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition-all">
            <Maximize2 size={14} /> 원본/확대
          </button>
        </div>

        <div className="p-5 border-b">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 mr-2">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-gray-900">{photo.desc}</h2>
                {isMyPost && <button onClick={handleUpdateDesc} className="text-gray-400 hover:text-blue-600 p-1"><Edit2 size={16} /></button>}
              </div>
              <div className="text-sm text-gray-500 flex items-center flex-wrap gap-2">
                <span>By {photo.uploader}</span>
                <span className="text-gray-300">|</span>
                <div className="flex items-center gap-1 group cursor-pointer" onClick={handleUpdateYear}>
                  <Calendar size={14} className="text-gray-400" />
                  {photo.photoYear ? <span className="text-gray-700">{photo.photoYear}년</span> : <span className="text-orange-500 font-bold bg-orange-100 px-2 py-0.5 rounded-full text-xs animate-pulse">언제 찍었나요?</span>}
                  <Edit2 size={10} className="opacity-50 group-hover:opacity-100 text-blue-500" />
                </div>
                <span className="text-gray-300">|</span>
                <span className="flex items-center gap-1"><Eye size={14}/> {photo.viewCount || 0}</span>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex flex-wrap gap-2 mb-2">
              {displayTags.map((tag, i) => (<span key={i} className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-sm font-medium border border-blue-100">{formatTag(tag)}</span>))}
            </div>
            <button onClick={() => setEditingTags(true)} className="text-sm text-gray-500 flex items-center gap-1 hover:text-blue-600"><Plus size={14} /> 태그(기수) 추가</button>
          </div>

          <div className="flex gap-2">
            <button onClick={handleLike} className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border ${isLiked ? 'bg-red-50 border-red-100 text-red-500' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
              <Heart size={20} className={isLiked ? "fill-red-500" : ""} /> {(photo.likes || []).length}
            </button>
            <button onClick={() => openSaveModal && openSaveModal(photo.id)} className="flex-1 py-3 bg-blue-50 border border-blue-100 text-blue-700 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
              <FolderPlus size={20} /> 앨범담기
            </button>
          </div>
        </div>

        <CommentSection 
          photoId={photo.id} 
          currentUser={currentUser} 
          userData={{name: currentUser.displayName || '알수없음', gisu: '?', ...currentUser}} 
          showToast={showToast} 
        />
      </ScrollContent>

      {editingTags && <TagEditModal photo={photo} onSave={handleTagSave} closeModal={() => setEditingTags(false)} />}
    </div>
  );
}