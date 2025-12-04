import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ScrollContent, LoadingSpinner } from './Layout';
import { db } from '../firebase';
import { documentId, collection, query, where, getDocs } from 'firebase/firestore';

export default function AlbumDetailOverlay({ albumId, collections, onClose, onPhotoClick }) {
  const activeAlbum = collections.find((c) => c.id === albumId);
  const [albumPhotos, setAlbumPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlbumPhotos = async () => {
      if (!activeAlbum || !activeAlbum.photoIds || activeAlbum.photoIds.length === 0) {
        setAlbumPhotos([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const photoIds = activeAlbum.photoIds;
        // Firestore 'in' 쿼리는 한 번에 10개 제한이 있어서 Promise.all로 병렬 처리
        const promises = photoIds.map(id => 
            getDocs(query(collection(db, 'photos'), where(documentId(), '==', id)))
        );
        
        const snapshots = await Promise.all(promises);
        const list = snapshots
            .map(snap => !snap.empty ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null)
            .filter(p => p !== null);
            
        // 최신순 정렬
        list.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        setAlbumPhotos(list);
        
      } catch (e) {
        console.error("앨범 로딩 실패:", e);
      }
      setLoading(false);
    };

    fetchAlbumPhotos();
  }, [activeAlbum]);
  
  if (!activeAlbum) return null;
  
  return ( 
    <div className="flex flex-col h-full w-full bg-white">
      <div className="bg-white p-3 sticky top-0 z-20 shadow-sm flex items-center gap-2 shrink-0">
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
          <ArrowLeft size={24} className="text-gray-700" />
        </button>
        <span className="font-bold text-lg text-blue-900 truncate max-w-[200px]">{activeAlbum.name}</span>
      </div>
      
      {loading ? <LoadingSpinner msg="앨범을 펼치는 중..." /> : (
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
      )}
    </div> 
  );
}