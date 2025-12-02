import React, { useState } from 'react';
import { X } from 'lucide-react';
import { formatTag } from '../utils'; // utils에서 함수 가져오기

export default function GisuInput({ tags, setTags }) {
  const [input, setInput] = useState("");

  const addGisu = () => {
    if (!input) return;
    const newTag = /^\d+$/.test(input) ? `${input}기` : input;
    if (!tags.includes(newTag)) setTags([...tags, newTag]);
    setInput("");
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input 
          type="number" 
          pattern="[0-9]*" 
          inputMode="numeric" 
          className="flex-1 border p-3 rounded-lg bg-gray-50 outline-none focus:bg-white" 
          placeholder="기수 (숫자만)" 
          value={input} 
          onChange={e => setInput(e.target.value.replace(/[^0-9]/g, ""))} 
          onKeyPress={e => e.key === 'Enter' && addGisu()}
        />
        <button onClick={addGisu} className="bg-blue-600 text-white px-4 rounded-lg font-bold shrink-0">추가</button>
      </div>
      <div className="flex flex-wrap gap-2 min-h-[40px] p-3 bg-gray-50 rounded-lg border border-dashed border-gray-200">
        {tags.length === 0 && <span className="text-gray-400 text-xs py-1">입력된 기수가 없습니다.</span>}
        {tags.map((tag, i) => (
          <span key={i} className="bg-white text-blue-600 border border-blue-200 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 shadow-sm">
            {formatTag(tag)}
            <button onClick={() => setTags(tags.filter(t => t !== tag))} className="text-gray-400 hover:text-red-500"><X size={14}/></button>
          </span>
        ))}
      </div>
    </div>
  );
}