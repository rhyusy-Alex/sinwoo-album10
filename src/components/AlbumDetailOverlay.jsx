import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { ScrollContent } from './Layout'; // Layout에서 ScrollContent 가져오기

export default function AlbumDetailOverlay({ albumId, collections, photos, onClose, onPhotoClick }) {
  // 현재 보고 있는 앨범 찾기
  const activeAlbum = collections.find((c) => c.id === albumId);
  
  if (!activeAlbum) return null;
  
  // 앨범에 포함된 사진들만 필터링
  const albumPhotos = photos.filter((p) => (activeAlbum.photoIds || []).includes(p.id));
  
  return ( 
    <div className="flex flex-col h-full w-full bg-white">
      {/* 상단 헤더 */}
      <div className="bg-white p-3 sticky top-0 z-20 shadow-sm flex items-center gap-2 shrink-0">
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
          <ArrowLeft size={24} className="text-gray-700" />
        </button>
        <span className="font-bold text-lg text-blue-900 truncate max-w-[200px]">{activeAlbum.name}</span>
      </div>

      {/* 앨범 사진 리스트 */}
      <ScrollContent type="list">
        {albumPhotos.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm gap-3">
            <p>이 앨범은 비어있습니다.</p>
            <button onClick={onClose} className="bg-blue-100 text-blue-600 px-4 py-2 rounded-full font-bold text-xs hover:bg-blue-200">
              📸 사진 담으러 가기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-0.5">
            {albumPhotos.map((p) => (
              <div key={p.id} onClick={() => onPhotoClick(p)} className="aspect-square relative cursor-pointer">
                <img src={p.url} className="w-full h-full object-cover" alt="album item" />
              </div>
            ))}
          </div>
        )}
      </ScrollContent>
    </div> 
  );
}