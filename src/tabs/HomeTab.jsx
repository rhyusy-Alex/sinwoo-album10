import React, { useState } from 'react';
import { PageLayout, ScrollContent } from '../components/Layout';
import { MessageCircle } from 'lucide-react';

export default function HomeTab({ photos, collections, openSaveModal, onPhotoClick }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('upload_desc');

  // 검색 필터링
  const filtered = photos.filter((p) => 
    (p.desc || "").includes(searchTerm) || 
    (p.tags && p.tags.some((t) => t.includes(searchTerm))) || 
    (p.uploader || "").includes(searchTerm)
  );

  // 정렬 로직
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
      {/* 상단 검색 및 필터 바 */}
      <div className="p-3 border-b sticky top-0 bg-white z-10 flex flex-col gap-2">
        <div className="relative w-full">
          <input 
            className="w-full p-2 pl-9 border rounded-lg text-sm bg-gray-50 outline-none focus:ring-1 focus:ring-blue-200" 
            placeholder="검색 (이름, 기수)" 
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
        </div>
      </div>

      {/* 사진 그리드 */}
      <ScrollContent type="list">
        <div className={`grid gap-0.5 grid-cols-3`}>
          {sortedPhotos.map((p) => (
            <div key={p.id} onClick={() => onPhotoClick(p)} className="aspect-square cursor-pointer relative overflow-hidden group">
              <img src={p.url} className="w-full h-full object-cover" loading="lazy" alt="thumbnail" />
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
      </ScrollContent>
    </PageLayout>
  );
}