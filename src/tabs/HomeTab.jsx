import React, { useState, useEffect } from 'react';
import { PageLayout, ScrollContent, LoadingSpinner } from '../components/Layout';
import { MessageCircle, ArrowDownCircle } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';

export default function HomeTab({ openSaveModal, onPhotoClick }) {
  const [photos, setPhotos] = useState([]);
  const [lastDoc, setLastDoc] = useState(null); // 다음 페이지 시작점
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true); // 더 불러올게 남았나?
  
  // 검색/필터 상태 (현재 로딩된 것들 내에서만 동작)
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('upload_desc');

  // 1. 첫 페이지 로딩 (초기화)
  const fetchInitialPhotos = async () => {
    setLoading(true);
    try {
      // 최신순 21개 가져오기
      const q = query(
        collection(db, 'photos'), 
        orderBy('timestamp', 'desc'), 
        limit(21)
      );
      const snapshot = await getDocs(q);
      
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPhotos(list);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === 21);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInitialPhotos();
  }, []);

  // 2. 더 보기 (다음 페이지)
  const fetchMorePhotos = async () => {
    if (!lastDoc || loading) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'photos'), 
        orderBy('timestamp', 'desc'), 
        startAfter(lastDoc),
        limit(21)
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPhotos(prev => [...prev, ...list]); // 기존 리스트 뒤에 붙이기
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === 21);
      } else {
        setHasMore(false);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  // --- 클라이언트 사이드 필터링 (불러온 데이터 내에서) ---
  const filtered = photos.filter((p) => 
    (p.desc || "").includes(searchTerm) || 
    (p.tags && p.tags.some((t) => t.includes(searchTerm))) || 
    (p.uploader || "").includes(searchTerm)
  );

  const sortedPhotos = [...filtered].sort((a, b) => {
    switch (sortOption) {
      case 'upload_desc': return (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0);
      case 'upload_asc': return (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0);
      case 'year_desc': return (Number(b.photoYear) || 0) - (Number(a.photoYear) || 0);
      case 'year_asc': {
        const ya = a.photoYear ? Number(a.photoYear) : 9999;
        const yb = b.photoYear ? Number(b.photoYear) : 9999;
        return ya - yb;
      }
      case 'random': return 0.5 - Math.random();
      default: return 0;
    }
  });

  return (
    <PageLayout>
      {/* 상단 검색바 */}
      <div className="p-3 border-b sticky top-0 bg-white z-10 flex flex-col gap-2 shadow-sm">
        <div className="relative w-full">
          <input 
            className="w-full p-2 pl-9 border rounded-lg text-sm bg-gray-50 outline-none focus:ring-1 focus:ring-blue-200" 
            placeholder="검색 (현재 로딩된 사진 중)" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
          <div className="absolute left-3 top-2.5 text-gray-400">🔍</div>
        </div>
        <div className="flex justify-between items-center">
          <select 
            className="text-xs font-bold bg-gray-50 border rounded-lg px-2 py-1.5 outline-none text-gray-600" 
            value={sortOption} 
            onChange={(e) => setSortOption(e.target.value)}
          >
            <option value="upload_desc">최근 게시물</option>
            <option value="upload_asc">과거 게시물</option>
            <option value="year_desc">최근 촬영일</option>
            <option value="year_asc">과거 촬영일</option>
            <option value="random">랜덤 추억</option>
          </select>
          <span className="text-[10px] text-gray-400">총 {photos.length}장 로딩됨</span>
        </div>
      </div>

      {/* 사진 리스트 */}
      <ScrollContent type="list">
        <div className={`grid gap-0.5 grid-cols-3`}>
          {sortedPhotos.map((p) => (
            <div key={p.id} onClick={() => onPhotoClick(p)} className="aspect-square cursor-pointer relative overflow-hidden group">
              <img src={p.url} className="w-full h-full object-cover" loading="lazy" alt="thumb" />
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

        {/* 더 보기 버튼 */}
        {hasMore && (
          <div className="p-4 flex justify-center">
            <button 
              onClick={fetchMorePhotos} 
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-gray-100 text-gray-600 rounded-full text-sm font-bold hover:bg-gray-200 transition-colors"
            >
              {loading ? <LoadingSpinner msg=""/> : <><ArrowDownCircle size={16}/> 더 보기</>}
            </button>
          </div>
        )}
        
        {!hasMore && photos.length > 0 && (
          <div className="p-6 text-center text-xs text-gray-300">
            모든 추억을 다 불러왔습니다.
          </div>
        )}
      </ScrollContent>
    </PageLayout>
  );
}