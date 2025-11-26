import React, { useState, useEffect } from 'react';
import { Camera, Users, PlusSquare, User, Share2, Download, Heart, Grid, LayoutGrid, FolderPlus, Edit2, Check, X, Plus, BookHeart, LogOut, Mail, Lock } from 'lucide-react';
import { db, storage, auth } from './firebase';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';

export default function App() {
  const [user, setUser] = useState(null); 
  const [userData, setUserData] = useState(null); 
  const [loading, setLoading] = useState(true); 

  const [activeTab, setActiveTab] = useState('home');
  const [photos, setPhotos] = useState([]);
  const [members, setMembers] = useState([]);
  const [toast, setToast] = useState(null);
  const [appLoading, setAppLoading] = useState(false);
  const [collections, setCollections] = useState(() => {
    const saved = localStorage.getItem('sinwoo_collections');
    return saved ? JSON.parse(saved) : [{ id: 1, name: "♥ 기본 보관함", photoIds: [] }];
  });

  useEffect(() => { localStorage.setItem('sinwoo_collections', JSON.stringify(collections)); }, [collections]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setUserData(docSnap.data());
        setUser(currentUser);
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "photos"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPhotos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const createCollection = (name) => { setCollections([...collections, { id: Date.now(), name: name || "새 폴더", photoIds: [] }]); showToast("폴더 생성 완료!"); };
  const renameCollection = (id, newName) => { setCollections(collections.map(c => c.id === id ? { ...c, name: newName } : c)); showToast("이름 변경 완료"); };
  const toggleCollectionItem = (colId, pId) => { setCollections(collections.map(c => c.id === colId ? { ...c, photoIds: c.photoIds.includes(pId) ? c.photoIds.filter(id=>id!==pId) : [...c.photoIds, pId] } : c)); };

  const [savingPhotoId, setSavingPhotoId] = useState(null);

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-100 font-bold">로딩중...</div>;
  if (!user) return <AuthScreen />;

  return (
    // ★★★ [수정됨] 화면 꽉 차게 변경 (배경 회색 제거, 너비 제한 완화) ★★★
    <div className="w-full h-[100dvh] bg-white overflow-hidden relative flex flex-col mx-auto max-w-lg shadow-xl">
      
      <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex justify-between items-center shrink-0">
        <h1 className="text-xl font-bold text-blue-900">신우 Photo</h1>
        <button onClick={() => alert("준비중")} className="p-2 text-gray-600"><Share2 size={20} /></button>
      </header>

      <main className="flex-1 overflow-hidden p-0 relative">
        {activeTab === 'home' && <HomeTab photos={photos} collections={collections} openSaveModal={setSavingPhotoId} />}
        {activeTab === 'albums' && <AlbumsTab photos={photos} collections={collections} openSaveModal={setSavingPhotoId} />}
        {activeTab === 'members' && <MembersTab members={members} />}
        {activeTab === 'upload' && <UploadTab setActiveTab={setActiveTab} showToast={showToast} userData={userData} setLoading={setAppLoading} />}
        {activeTab === 'mypage' && <MyPageTab userData={userData} collections={collections} renameCollection={renameCollection} />}
      </main>

      {appLoading && (<div className="absolute inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center flex-col text-white"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mb-2"></div><p>처리중...</p></div>)}

      <nav className="bg-white border-t flex justify-around items-center h-16 absolute bottom-0 w-full z-30 px-1 shrink-0">
        <NavBtn icon={<Camera />} label="홈" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
        <NavBtn icon={<Users />} label="멤버" active={activeTab === 'members'} onClick={() => setActiveTab('members')} />
        <NavBtn icon={<PlusSquare />} label="업로드" active={activeTab === 'upload'} onClick={() => setActiveTab('upload')} />
        <NavBtn icon={<BookHeart />} label="앨범" active={activeTab === 'albums'} onClick={() => setActiveTab('albums')} />
        <NavBtn icon={<User />} label="내정보" active={activeTab === 'mypage'} onClick={() => setActiveTab('mypage')} />
      </nav>

      {savingPhotoId && <SaveCollectionModal photos={photos} photoId={savingPhotoId} collections={collections} toggleCollectionItem={toggleCollectionItem} closeModal={() => setSavingPhotoId(null)} createCollection={createCollection}/>}
      {toast && <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-full shadow-lg text-sm animate-bounce z-50 whitespace-nowrap">{toast}</div>}
    </div>
  );
}

// --- 로그인/회원가입 화면 (수정됨: 로고 원본 그대로) ---
function AuthScreen() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [gisu, setGisu] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    setError(""); setLoading(true);
    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if(!name || !gisu) throw new Error("이름과 기수를 입력해주세요.");
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", userCredential.user.uid), { 
          name, gisu, email, joinedAt: serverTimestamp() 
        });
      }
    } catch (err) { 
        // 에러 메시지 친절하게
        if (err.code === 'auth/invalid-email') setError("이메일 형식이 올바르지 않아요. 🤔");
        else if (err.code === 'auth/user-not-found') setError("가입된 계정이 없어요. 회원가입을 해주세요. 🙌");
        else if (err.code === 'auth/wrong-password') setError("비밀번호가 일치하지 않아요. 🔒");
        else if (err.code === 'auth/email-already-in-use') setError("이미 가입된 이메일입니다. 😉");
        else if (err.code === 'auth/weak-password') setError("비밀번호는 6자리 이상이어야 해요. 🛡️");
        else setError("로그인 실패: " + err.message);
    }
    setLoading(false);
  };
  
  const bgImageUrl = "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop";

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-900 bg-cover bg-center relative before:absolute before:inset-0 before:bg-black/50" style={{ backgroundImage: `url(${bgImageUrl})` }}>
      <div className="bg-black/70 p-8 rounded-2xl shadow-2xl w-full max-w-md text-center backdrop-blur-md border border-white/10 z-10 mx-4">
        <div className="mb-6 flex justify-center">
          <img src="/logo.jpg" alt="신우 로고" className="w-40 h-auto object-contain" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2 font-serif">신우 Photo</h1>
        <p className="text-gray-300 mb-6 text-sm">{isLoginMode ? "로그인" : "회원가입"}</p>
        <div className="space-y-3">
          <input className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 outline-none focus:border-yellow-500 transition-colors" placeholder="이메일" value={email} onChange={e=>setEmail(e.target.value)}/>
          <input type="password" className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 outline-none focus:border-yellow-500 transition-colors" placeholder="비밀번호 (6자리 이상)" value={password} onChange={e=>setPassword(e.target.value)}/>
          {!isLoginMode && (<><input className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 outline-none focus:border-yellow-500 transition-colors" placeholder="이름 (예: 홍길동)" value={name} onChange={e=>setName(e.target.value)}/><input className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 outline-none focus:border-yellow-500 transition-colors" placeholder="기수 (숫자만 입력)" type="number" value={gisu} onChange={e=>setGisu(e.target.value)}/></>)}
        </div>
        {error && <p className="text-red-400 text-sm mt-3 font-bold">⚠ {error}</p>}
        <button onClick={handleAuth} disabled={loading} className="w-full mt-6 bg-yellow-600 hover:bg-yellow-500 text-white p-3 rounded-xl font-bold shadow-lg transition-all">{loading ? "처리중..." : (isLoginMode ? "로그인" : "가입하기")}</button>
        <div className="mt-4 flex justify-center gap-2 text-sm"><span className="text-gray-400">{isLoginMode ? "계정이 없으신가요?" : "계정이 있으신가요?"}</span><button onClick={() => {setIsLoginMode(!isLoginMode); setError("");}} className="text-yellow-500 font-bold hover:underline">{isLoginMode ? "회원가입" : "로그인"}</button></div>
      </div>
    </div>
  );
}

function UploadTab({ setActiveTab, showToast, userData, setLoading }) {
  const [desc, setDesc] = useState(""); const [tags, setTags] = useState(""); const [file, setFile] = useState(null); const [preview, setPreview] = useState(null);
  const handleUpload = async () => { if (!file || !desc) return alert("사진과 설명을 입력해주세요."); try { setLoading(true); const fileRef = ref(storage, `photos/${Date.now()}_${file.name}`); await uploadBytes(fileRef, file); const url = await getDownloadURL(fileRef); const defaultTags = [`${userData.gisu}기`, userData.name]; const inputTags = tags.split(",").map(t => t.trim()).filter(t => t); const finalTags = [...new Set([...defaultTags, ...inputTags])]; await addDoc(collection(db, "photos"), { url, desc, tags: finalTags, uploader: userData.name, uploaderId: auth.currentUser.uid, timestamp: serverTimestamp() }); setLoading(false); showToast("게시 완료!"); setActiveTab('home'); } catch (e) { setLoading(false); alert(e.message); } };
  return ( <div className="p-4 bg-white h-full overflow-y-auto pb-20"><div className="border-2 border-dashed border-gray-300 bg-gray-50 rounded-lg h-64 mb-4 flex flex-col items-center justify-center relative overflow-hidden">{preview ? <img src={preview} className="w-full h-full object-contain" /> : <div className="text-center text-gray-400"><Camera size={48} className="mx-auto mb-2 opacity-50"/><p>사진 선택</p></div>}<input type="file" accept="image/*" onChange={(e)=>{if(e.target.files[0]){setFile(e.target.files[0]);setPreview(URL.createObjectURL(e.target.files[0]))}}} className="absolute inset-0 opacity-0 cursor-pointer" /></div><input className="w-full border p-3 rounded-lg mb-4 bg-gray-50" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="설명 입력" /><input className="w-full border p-3 rounded-lg mb-6 bg-gray-50" value={tags} onChange={e=>setTags(e.target.value)} placeholder="추가 태그" /><button onClick={handleUpload} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold shadow hover:bg-blue-700">게시하기</button></div> );
}
function MyPageTab({ userData, collections, renameCollection }) { if (!userData) return null; return ( <div className="p-4 h-full overflow-y-auto pb-20"><div className="bg-white p-6 rounded-lg shadow text-center mb-6"><div className="w-20 h-20 bg-blue-100 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl">😎</div><h2 className="text-xl font-bold">{userData.name}</h2><p className="text-gray-500">{userData.gisu}기</p><button onClick={() => confirm("로그아웃 하시겠습니까?") && signOut(auth)} className="mt-4 text-sm text-red-500 border border-red-200 px-3 py-1 rounded-full flex items-center justify-center gap-1 mx-auto hover:bg-red-50"><LogOut size={14}/> 로그아웃</button></div><div className="mb-4"><h3 className="font-bold text-lg text-gray-800">📂 나의 북마크</h3></div><div className="space-y-3">{collections.map(col => (<div key={col.id} className="bg-white p-4 rounded-lg shadow-sm border flex items-center justify-between"><div><input className="font-bold text-gray-800 border-none w-40" value={col.name} onChange={(e) => renameCollection(col.id, e.target.value)} /><p className="text-xs text-gray-500">{col.photoIds.length}장의 사진</p></div><Edit2 size={16} className="text-gray-400" /></div>))}</div></div> ); }
function MembersTab({ members }) { const [search, setSearch] = useState(""); return ( <div className="h-full flex flex-col"><div className="bg-white p-4 sticky top-0 shadow-sm shrink-0"><input className="w-full p-2 border rounded" placeholder="이름 검색" value={search} onChange={e => setSearch(e.target.value)}/></div><ul className="bg-white divide-y flex-1 overflow-y-auto pb-20">{members.filter(m => m.name.includes(search)).map(m => (<li key={m.id} className="p-4 flex gap-3 items-center"><div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">👤</div><div><p className="font-bold">{m.name} <span className="text-gray-500 text-sm">| {m.gisu}기</span></p></div></li>))}</ul></div> ); }
function HomeTab({ photos, collections, openSaveModal }) { const [searchTerm, setSearchTerm] = useState(""); const [selectedPhoto, setSelectedPhoto] = useState(null); const [isWideGrid, setIsWideGrid] = useState(false); const filtered = photos.filter(p => p.desc.includes(searchTerm) || (p.tags && p.tags.some(t => t.includes(searchTerm))) || p.uploader.includes(searchTerm)); useEffect(() => { setSelectedPhoto(filtered.length > 0 ? filtered[0] : null); }, [searchTerm, photos]); return ( <div className="h-full flex flex-col bg-white overflow-hidden"> <div className="shrink-0 flex flex-col bg-white shadow-md z-10 relative"><div className="p-2 border-b"><div className="relative"><input className="w-full p-2 pl-3 border rounded-lg text-sm bg-gray-100 outline-none" placeholder="검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /><div className="absolute right-2 top-2 text-gray-400">🔍</div></div></div>{selectedPhoto ? (<div><div className="w-full h-56 bg-black flex items-center justify-center overflow-hidden"><img src={selectedPhoto.url} className="h-full object-contain" /></div><div className="p-3 pb-4"><div className="flex justify-between items-start mb-2"><div className="truncate font-bold text-gray-800">{selectedPhoto.desc}</div><span className="text-xs bg-gray-100 px-2 py-1 rounded">By {selectedPhoto.uploader}</span></div><div className="flex gap-2"><button onClick={() => openSaveModal(selectedPhoto.id)} className={`flex-1 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 ${collections.some(col => col.photoIds.includes(selectedPhoto.id)) ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-gray-100 text-gray-700'}`}><Heart size={18} className={collections.some(col => col.photoIds.includes(selectedPhoto.id)) ? "fill-red-500" : ""} /> 앨범담기</button><button className="px-3 py-2 bg-gray-100 rounded-lg"><Download size={18}/></button></div></div></div>) : <div className="h-56 flex items-center justify-center text-gray-400">검색 결과 없음</div>}</div><div className="flex-1 overflow-y-auto bg-white pb-20"><div className="sticky top-0 bg-white/90 p-2 flex justify-end border-b z-10"><button onClick={() => setIsWideGrid(!isWideGrid)} className="text-xs text-gray-500 flex items-center gap-1">{isWideGrid ? <LayoutGrid size={14}/> : <Grid size={14}/>} 보기변경</button></div><div className={`grid gap-0.5 ${isWideGrid ? 'grid-cols-5' : 'grid-cols-3'}`}>{filtered.map(p => (<div key={p.id} onClick={() => setSelectedPhoto(p)} className={`aspect-square cursor-pointer relative ${selectedPhoto?.id === p.id ? 'opacity-40' : ''}`}><img src={p.url} className="w-full h-full object-cover" /></div>))}</div></div></div> ); }
function AlbumsTab({ photos, collections, openSaveModal }) { const [currentAlbumId, setCurrentAlbumId] = useState(null); const [selectedPhoto, setSelectedPhoto] = useState(null); const currentAlbum = collections.find(c => c.id === currentAlbumId); const albumPhotos = currentAlbumId ? photos.filter(p => currentAlbum.photoIds.includes(p.id)) : []; if (!currentAlbumId) return ( <div className="p-4 bg-gray-50 h-full overflow-y-auto pb-20"><div className="grid grid-cols-2 gap-4">{collections.map(col => (<button key={col.id} onClick={() => { setCurrentAlbumId(col.id); setSelectedPhoto(null); }} className="bg-white p-4 rounded-xl shadow border flex flex-col items-center justify-center h-40"><FolderPlus size={32} className="text-yellow-600 mb-3" /><span className="font-bold text-gray-800">{col.name}</span><span className="text-xs text-gray-500">{col.photoIds.length}장</span></button>))}</div></div> ); return ( <div className="h-full flex flex-col bg-white overflow-hidden"><div className="bg-white p-3 sticky top-0 z-20 shadow-sm flex items-center gap-2 shrink-0"><button onClick={() => setCurrentAlbumId(null)} className="font-bold p-1">← 뒤로</button><span className="font-bold text-blue-900">📂 {currentAlbum.name}</span></div>{(selectedPhoto || albumPhotos[0]) ? (<div className="bg-white border-b shadow-md pb-2 shrink-0"><div className="w-full h-56 bg-black flex items-center justify-center overflow-hidden"><img src={(selectedPhoto || albumPhotos[0]).url} className="h-full object-contain" /></div><div className="p-3"><p className="font-bold">{(selectedPhoto || albumPhotos[0]).desc}</p></div></div>) : <div className="p-10 text-center text-gray-400">비어있음</div>}<div className="flex-1 overflow-y-auto bg-white pb-20"><div className="grid grid-cols-3 gap-0.5">{albumPhotos.map(p => (<div key={p.id} onClick={() => setSelectedPhoto(p)} className="aspect-square cursor-pointer"><img src={p.url} className="w-full h-full object-cover" /></div>))}</div></div></div> ); }
function SaveCollectionModal({ photoId, collections, toggleCollectionItem, closeModal, createCollection }) { const [newColName, setNewColName] = useState(""); const [isCreating, setIsCreating] = useState(false); return ( <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"><div className="bg-white w-full max-w-sm rounded-xl overflow-hidden shadow-2xl"><div className="p-4 border-b flex justify-between items-center"><h3 className="font-bold">어디에 담을까요?</h3><button onClick={closeModal}><X size={20}/></button></div><div className="max-h-60 overflow-y-auto p-2">{collections.map(col => (<button key={col.id} onClick={() => toggleCollectionItem(col.id, photoId)} className={`w-full text-left p-3 rounded-lg mb-1 flex justify-between items-center ${col.photoIds.includes(photoId) ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}`}><span className="font-medium">{col.name}</span>{col.photoIds.includes(photoId) && <Check size={18}/>}</button>))}</div><div className="p-3 border-t bg-gray-50">{isCreating ? (<div className="flex gap-2"><input autoFocus className="flex-1 border p-2 rounded text-sm" placeholder="새 폴더 이름" value={newColName} onChange={e => setNewColName(e.target.value)} /><button onClick={() => { createCollection(newColName); setIsCreating(false); setNewColName(""); }} className="bg-blue-600 text-white px-3 rounded text-sm font-bold">확인</button></div>) : (<button onClick={() => setIsCreating(true)} className="w-full py-2 text-blue-600 text-sm font-bold flex items-center justify-center gap-1"><Plus size={16}/> 새 폴더 만들기</button>)}</div></div></div> ); }
function NavBtn({ icon, label, active, onClick }) { return ( <button onClick={onClick} className={`flex flex-col items-center justify-center flex-1 min-w-0 ${active ? 'text-blue-600' : 'text-gray-400'}`}>{React.cloneElement(icon, { size: 22 })}<span className="text-[10px] mt-1 font-bold whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">{label}</span></button> ); }

