import React from 'react';
import { PageLayout } from '../components/Layout';
import { FolderPlus, Trash2, Plus } from 'lucide-react';

export default function AlbumsTab({ collections, onOpenAlbum, createCollection, deleteCollection, renameCollection }) {
  return (
    <PageLayout>
      <div className="p-4">
        <h2 className="font-bold text-lg mb-4 text-gray-700">📂 나의 앨범</h2>
        <div className="grid grid-cols-2 gap-4">
          {collections.map((col) => (
            <div key={col.id} onClick={() => onOpenAlbum(col.id)} className="bg-gray-50 p-4 rounded-xl border flex flex-col items-center justify-center h-40 active:scale-95 transition-transform hover:bg-blue-50 relative group cursor-pointer">
              <FolderPlus size={32} className="text-yellow-600 mb-3" />
              <div onClick={(e) => e.stopPropagation()}>
                <input className="font-bold text-gray-800 text-center bg-transparent border-none w-full focus:ring-0 p-0" value={col.name} onChange={(e) => renameCollection(col.id, e.target.value)} />
              </div>
              <span className="text-xs text-gray-500">{col.photoIds.length}장</span>
              {!col.isDefault && (
                <button onClick={(e) => { e.stopPropagation(); deleteCollection(col.id, col.isDefault); }} className="absolute top-2 right-2 text-gray-300 hover:text-red-500 p-1"><Trash2 size={16} /></button>
              )}
            </div>
          ))}
          <button onClick={() => createCollection()} className="border-2 border-dashed border-gray-300 p-4 rounded-xl flex flex-col items-center justify-center h-40 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors">
            <Plus size={32} className="mb-2" />
            <span className="text-sm font-bold">새 앨범 만들기</span>
          </button>
        </div>
        {collections.length === 0 && <div className="text-center text-gray-400 py-20">아직 앨범이 없습니다.</div>}
      </div>
    </PageLayout>
  );
}