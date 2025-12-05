import React, { useState } from 'react';
import { PageLayout, ScrollContent, LoadingSpinner } from '../components/Layout';
import { Camera } from 'lucide-react';
import { storage, db, auth } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { addDoc, collection, doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import GisuInput from '../components/GisuInput';

export default function UploadTab({ setActiveTab, showToast, userData, setLoading }) {
  // 방어 코드: 유저 정보가 로딩 안 됐으면 스피너 표시
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
      
      // 1. 스토리지에 사진 업로드
      const fileRef = ref(storage, `photos/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      
      // 2. DB에 데이터 저장
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
      
      // 3. 유저 활동 카운트 증가
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { uploadCount: increment(1) });
      
      setLoading(false);
      if(showToast) showToast('게시 완료! (+100점)');
      // 업로드 후 홈으로 이동 (애니메이션 적용된 함수 사용)
      setActiveTab('home'); 
    } catch (e) {
      setLoading(false);
      alert(e.message);
    }
  };

  return (
    <PageLayout>
      <ScrollContent type="form">
        <div className="border-2 border-dashed border-gray-200 bg-gray-50 rounded-2xl h-64 mb-6 flex flex-col items-center justify-center relative overflow-hidden hover:border-blue-300 transition-colors">
          {preview ? <img src={preview} className="w-full h-full object-contain" alt="preview" /> : <div className="text-center text-gray-400"><Camera size={48} className="mx-auto mb-2 opacity-30" /><p className="text-sm font-medium">사진을 선택해주세요</p></div>}
          <input type="file" accept="image/*" onChange={(e) => { if (e.target.files[0]) { setFile(e.target.files[0]); setPreview(URL.createObjectURL(e.target.files[0])); } }} className="absolute inset-0 opacity-0 cursor-pointer" />
        </div>
        <div className="space-y-5">
          <div>
            <label className="block font-bold text-gray-800 mb-2 text-sm">사진 설명</label>
            <input className="w-full border border-gray-200 p-3.5 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="어떤 순간인가요?" />
          </div>
          <div>
            <label className="block font-bold text-gray-800 mb-2 text-sm">촬영 연도 <span className="text-gray-400 font-normal">(선택)</span></label>
            <input type="number" pattern="[0-9]*" inputMode="numeric" className="w-full border border-gray-200 p-3.5 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all" value={photoYear} onChange={(e) => setPhotoYear(e.target.value)} placeholder="예: 1995" />
          </div>
          <div>
            <label className="block font-bold text-gray-800 mb-2 text-sm">등장 기수 <span className="text-gray-400 font-normal">(함께 채워가요!)</span></label>
            <GisuInput tags={tags} setTags={setTags} />
          </div>
        </div>
        <div className="bg-blue-50 p-4 rounded-xl mt-6 mb-8 text-xs text-blue-800 flex gap-3 items-start">
          <span className="text-lg">💡</span>
          <p>기수나 촬영 연도를 몰라도 괜찮아요. 나중에 다른 회원들이 댓글이나 태그 수정으로 알려줄 거예요!</p>
        </div>
        <button onClick={handleUpload} className="w-full bg-blue-900 text-white p-4 rounded-xl font-bold text-lg shadow-lg hover:bg-blue-800 active:scale-95 transition-all">게시하기</button>
      </ScrollContent>
    </PageLayout>
  );
}