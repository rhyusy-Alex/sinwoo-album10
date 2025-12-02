import React, { useState } from 'react';
import { X, Check, Plus } from 'lucide-react';

export default function SaveCollectionModal({ photoId, collections, toggleCollectionItem, closeModal, createCollection }) {
  const [newColName, setNewColName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-bold">어디에 담을까요?</h3>
          <button onClick={closeModal}><X size={20}/></button>
        </div>
        <div className="max-h-60 overflow-y-auto p-2">
          {collections.map(col => (
            <button key={col.id} onClick={async () => { await toggleCollectionItem(col.id, photoId); closeModal(); }} className={`w-full text-left p-3 rounded-lg mb-1 flex justify-between items-center ${col.photoIds.includes(photoId) ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}`}>
              <span className="font-medium">{col.name}</span>
              {col.photoIds.includes(photoId) && <Check size={18}/>}
            </button>
          ))}
        </div>
        <div className="p-3 border-t bg-gray-50">
          {isCreating ? (
            <div className="flex gap-2">
              <input autoFocus className="flex-1 border p-2 rounded text-sm" placeholder="새 앨범 이름" value={newColName} onChange={e => setNewColName(e.target.value)} />
              <button onClick={() => { createCollection(newColName); setIsCreating(false); setNewColName(""); }} className="bg-blue-600 text-white px-3 rounded text-sm font-bold">확인</button>
            </div>
          ) : (
            <button onClick={() => setIsCreating(true)} className="w-full py-2 text-blue-600 text-sm font-bold flex items-center justify-center gap-1"><Plus size={16}/> 새 폴더 만들기</button>
          )}
        </div>
      </div>
    </div>
  );
}