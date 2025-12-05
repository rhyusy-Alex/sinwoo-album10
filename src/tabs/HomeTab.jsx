import React, { useState, useEffect } from 'react';
import { PageLayout, ScrollContent, LoadingSpinner } from '../components/Layout';
import { MessageCircle, ArrowDownCircle, Search } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';

export default function HomeTab({ openSaveModal, onPhotoClick }) {
  const [photos, setPhotos] = useState([]);
  const [lastDoc, setLastDoc] = useState(null); 
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true); 
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('upload_desc');

  const fetchInitialPhotos = async () => {
    setLoading(true);
    try {
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
        setPhotos(prev => [...prev, ...list]); 
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
      {/* 상단 헤더 영역 */}
      <div className="bg-white z-10 flex flex-col sticky top-0 border-b border-gray-100 shadow-sm">
        <div className="px-5 pt-6 pb-4 bg-gradient-to-r from-blue-50 to-white">
          {/* ★ [수정됨] 상단 장식 삭제 & 한 줄 배치 */}
          <h2 className="text-xl font-bold text-gray-900 leading-tight">
            함께 쌓아가는 <span className="text-blue-900">신우의 추억</span> 📸
          </h2>
          <p className="text-xs text-gray-500 mt-1">그 시절 우리가 사랑했던 순간들을 찾아보세요.</p>
        </div>

        {/* 검색 및 필터 바 */}
        <div className="p-3 flex flex-col gap-2 bg-white">
          <div className="relative w-full">
            <input 
              className="w-full p-3 pl-10 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all" 
              placeholder="검색 (이름, 기수, 내용)" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
            <div className="absolute left-3 top-3 text-gray-400">
              <Search size={18}/>
            </div>
          </div>
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] text-gray-400 font-medium">현재 {photos.length}장의 추억</span>
            <select 
              className="text-xs font-bold bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none text-gray-600 focus:border-blue-500" 
              value={sortOption} 
              onChange={(e) => setSortOption(e.target.value)}
            >
              <option value="upload_desc">최근 게시물</option>
              <option value="upload_asc">과거 게시물</option>
              <option value="year_desc">최근 촬영일</option>
              <option value="year_asc">과거 촬영일</option>
              <option value="random">랜덤 추억</option>
            </select>
          </div>
        </div>
      </div>

      {/* 사진 리스트 */}
      <ScrollContent type="list">
        <div className={`grid gap-0.5 grid-cols-3`}>
          {sortedPhotos.map((p) => (
            <div key={p.id} onClick={() => onPhotoClick(p)} className="aspect-square cursor-pointer relative overflow-hidden group">
              <img src={p.url} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" loading="lazy" alt="thumb" />
              {p.commentsCount > 0 && (
                <div className="absolute top-1 right-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 backdrop-blur-sm">
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

        {hasMore && (
          <div className="p-6 flex justify-center pb-20">
            <button 
              onClick={fetchMorePhotos} 
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 text-gray-600 rounded-full text-sm font-bold hover:bg-gray-50 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm active:scale-95"
            >
              {loading ? <LoadingSpinner msg=""/> : <><ArrowDownCircle size={16}/> 추억 더 불러오기</>}
            </button>
          </div>
        )}
        
        {!hasMore && photos.length > 0 && (
          <div className="p-8 text-center">
            <p className="text-xs text-gray-300 mb-2">모든 추억을 다 불러왔습니다.</p>
            <div className="w-24 h-1 bg-gray-100 mx-auto rounded-full"></div>
          </div>
        )}
      </ScrollContent>
    </PageLayout>
  );
}