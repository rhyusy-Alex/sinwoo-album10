import React, { useState } from 'react';
import { X } from 'lucide-react';
import GisuInput from './GisuInput'; // 방금 만든 부품 가져오기

export default function TagEditModal({ photo, onSave, closeModal }) {
  const [tags, setTags] = useState(photo.tags || []);
  
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b flex justify-between items-center bg-white">
          <h3 className="font-bold text-lg">기수 수정</h3>
          <button onClick={closeModal}><X size={24} className="text-gray-500"/></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <img src={photo.url} className="w-16 h-16 object-cover rounded-lg border" alt="thumbnail" />
            <div>
              <p className="font-bold text-sm truncate w-40">{photo.desc}</p>
            </div>
          </div>
          {/* 기수 입력 컴포넌트 사용 */}
          <GisuInput tags={tags} setTags={setTags} />
          
          <button onClick={() => onSave(photo, tags)} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-lg mt-2">저장하기</button>
        </div>
      </div>
    </div>
  );
}