import React, { useState } from 'react';
import { PageLayout, ScrollContent, LoadingSpinner } from '../components/Layout';
import { Camera, Image as ImageIcon } from 'lucide-react'; 
import { storage, db, auth } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { addDoc, collection, doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import GisuInput from '../components/GisuInput';

export default function UploadTab({ setActiveTab, showToast, userData, setLoading }) {
  if (!userData) return <LoadingSpinner msg="회원 정보를 불러오는 중..." />;

  const [desc, setDesc] = useState('');
  const [photoYear, setPhotoYear] = useState('');
  const [tags, setTags] = useState([]); 
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  const handleUpload = async () => {
    if (!file || !desc) return alert('사진과 설명을 입력해주세요.');
    try {
      setLoading(true);
      
      const fileRef = ref(storage, `photos/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      
      await addDoc(collection(db, 'photos'), {
        url, 
        desc, 
        tags: tags,
        photoYear,
        uploader: userData.name,
        uploaderId: auth.currentUser.uid,
        timestamp: serverTimestamp(),
        commentsCount: 0,
        viewCount: 0
      });
      
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { uploadCount: increment(1) });
      
      setLoading(false);
      if(showToast) showToast('게시 완료! (+100점)');
      setActiveTab('home'); 
    } catch (e) {
      setLoading(false);
      alert(e.message);
    }
  };

  return (
    <PageLayout>
      <ScrollContent type="form">
        {/* ★ [수정됨] 상단 장식 삭제 & 한 줄 배치 */}
        <div className="mb-6 mt-4">
          <h2 className="text-xl font-bold text-gray-900 mb-2 leading-tight">
            잠자고 있는 추억을 <span className="text-blue-600">깨워주세요 ✨</span>
          </h2>
          <p className="text-sm text-gray-500">
            당신의 사진첩 속 한 장이<br/>
            우리 모두에게는 소중한 역사가 됩니다.
          </p>
        </div>

        {/* 사진 선택 영역 */}
        <div className="border-2 border-dashed border-gray-300 bg-gray-50 rounded-2xl h-72 mb-8 flex flex-col items-center justify-center relative overflow-hidden group hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer">
          {preview ? (
            <img src={preview} className="w-full h-full object-contain" alt="preview" />
          ) : (
            <div className="text-center text-gray-400 group-hover:text-blue-500 transition-colors">
              <div className="bg-white p-4 rounded-full shadow-sm mb-3 inline-block">
                <ImageIcon size={32} />
              </div>
              <p className="text-sm font-bold">여기를 눌러 사진 선택</p>
              <p className="text-xs font-normal mt-1 opacity-70">또는 파일을 드래그하세요</p>
            </div>
          )}
          <input type="file" accept="image/*" onChange={(e) => { if (e.target.files[0]) { setFile(e.target.files[0]); setPreview(URL.createObjectURL(e.target.files[0])); } }} className="absolute inset-0 opacity-0 cursor-pointer" />
        </div>

        <div className="space-y-6">
          <div>
            <label className="block font-bold text-gray-800 mb-2 text-sm">사진 설명 <span className="text-red-500">*</span></label>
            <input className="w-full border border-gray-200 p-4 rounded-xl bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all placeholder:text-gray-300" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="어떤 순간인가요? (예: 95년 MT때)" />
          </div>
          <div>
            <label className="block font-bold text-gray-800 mb-2 text-sm">촬영 연도 <span className="text-gray-400 font-normal">(선택)</span></label>
            <input type="number" pattern="[0-9]*" inputMode="numeric" className="w-full border border-gray-200 p-4 rounded-xl bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all placeholder:text-gray-300" value={photoYear} onChange={(e) => setPhotoYear(e.target.value)} placeholder="예: 1995" />
          </div>
          <div>
            <label className="block font-bold text-gray-800 mb-2 text-sm">등장 기수 <span className="text-gray-400 font-normal">(함께 채워가요!)</span></label>
            <GisuInput tags={tags} setTags={setTags} />
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-xl mt-8 mb-8 flex gap-3 items-start border border-blue-100">
          <span className="text-xl">💡</span>
          <div className="text-xs text-blue-800">
            <p className="font-bold mb-1">작은 팁</p>
            <p>기수나 연도를 정확히 몰라도 괜찮아요.<br/>일단 올리면 다른 동문들이 댓글로 알려줄 거예요!</p>
          </div>
        </div>

        <button 
          onClick={handleUpload} 
          className="w-full bg-blue-900 text-white p-4 rounded-xl font-bold text-lg shadow-lg hover:bg-blue-800 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <Camera size={20} />
          추억 게시하기
        </button>
      </ScrollContent>
    </PageLayout>
  );
}