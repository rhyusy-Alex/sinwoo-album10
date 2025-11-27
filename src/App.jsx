import React, { useState, useEffect, useRef } from 'react';
import {
  Camera, Users, PlusSquare, User, Share2, Heart,
  Edit2, Check, X, Plus, BookHeart, LogOut,
  ArrowLeft, Calendar, Trash2, MessageCircle, Send, ThumbsUp,
  Grid, LayoutGrid, Maximize2, Download, Shield
} from 'lucide-react';

import { db, storage, auth } from './firebase';
import {
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp,
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  arrayUnion, arrayRemove, where
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';

// --- 유틸리티 (안전장치 추가) ---
const formatTag = (tag) => {
  if (!tag) return "";
  return /^\d+$/.test(tag) ? tag + '기' : tag;
};
const formatDate = (timestamp) => {
  if (!timestamp || !timestamp.seconds) return '';
  const date = new Date(timestamp.seconds * 1000);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
};

// --- 공통 레이아웃 컴포넌트 ---
const PageLayout = ({ children, className = "" }) => (
  <div className={`flex-1 w-full h-full bg-white flex flex-col overflow-hidden ${className}`}>
    {children}
  </div>
);

const ScrollContent = ({ children, type = 'list', className = "" }) => {
  const paddingClass = type === 'form' ? 'px-5 pt-5 pb-24' : 'pb-20';
  return (
    <div className={`flex-1 w-full h-full overflow-y-auto ${paddingClass} ${className}`}>
      {children}
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const TABS = ['home', 'members', 'upload', 'albums', 'mypage'];
  const [activeTab, setActiveTab] = useState('home');
  const isDetailViewRef = useRef(false);

  const [photos, setPhotos] = useState([]);
  const [members, setMembers] = useState([]);
  const [collections, setCollections] = useState([]);
  const [toast, setToast] = useState(null);
  const [appLoading, setAppLoading] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // 로그인 감시
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setUserData(docSnap.data());
        setUser(currentUser);
        setShowOnboarding(true);
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 로컬 저장소 앨범 초기화 (DB 연동 전 임시)
  useEffect(() => {
    const saved = localStorage.getItem('sinwoo_collections');
    if (saved) setCollections(JSON.parse(saved));
    else setCollections([{ id: 1, name: "♥ 기본 보관함", photoIds: [] }]);
  }, []);
  useEffect(() => { localStorage.setItem('sinwoo_collections', JSON.stringify(collections)); }, [collections]);

  // DB 구독 (사진)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'photos'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // ★ [안전장치] 데이터가 없어도 죽지 않도록 기본값({}) 처리
      setPhotos(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  // DB 구독 (멤버)
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      setMembers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  // DB 구독 (앨범)
  useEffect(() => {
    if (!user) { setCollections([]); return; }
    const q = query(collection(db, 'albums'), where('userId', '==', user.uid), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        try { await addDoc(collection(db, 'albums'), { userId: user.uid, name: '♥ 기본 앨범', photoIds: [], createdAt: serverTimestamp(), isDefault: true }); } catch (e) {}
        return;
      }
      setCollections(snapshot.docs.map((d) => ({ id: d.id, photoIds: d.data().photoIds || [], ...d.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  // 기능 함수들
  const createCollection = async (name) => {
    if (!user) return;
    try { await addDoc(collection(db, 'albums'), { userId: user.uid, name: name || '새 앨범', photoIds: [], createdAt: serverTimestamp(), isDefault: false }); showToast('앨범 생성 완료!'); } catch (e) { alert(e.message); }
  };
  const renameCollection = async (id, newName) => { try { await updateDoc(doc(db, 'albums', id), { name: newName }); showToast('이름 변경 완료'); } catch (e) { alert(e.message); } };
  const toggleCollectionItem = async (colId, pId) => {
    const col = collections.find((c) => c.id === colId); if (!col) return;
    const albumRef = doc(db, 'albums', colId);
    const isIncluded = (col.photoIds || []).includes(pId);
    try { await updateDoc(albumRef, { photoIds: isIncluded ? arrayRemove(pId) : arrayUnion(pId) }); } catch (e) { alert(e.message); }
  };
  const deleteCollection = async (id, isDefault) => {
    if (isDefault) { alert('기본 앨범은 삭제할 수 없습니다.'); return; }
    if (!confirm('앨범을 삭제하시겠습니까?')) return;
    try { await deleteDoc(doc(db, 'albums', id)); showToast('앨범 삭제 완료'); } catch (e) { alert(e.message); }
  };
  const handleUpdateTags = async (photoId, currentTags) => {
    const formatted = currentTags ? currentTags.map(formatTag) : [];
    const newTagsString = prompt('기수를 추가/수정해주세요', formatted.join(', '));
    if (newTagsString !== null) {
      const newTags = newTagsString.split(',').map((t) => { const trimmed = t.trim(); return /^\d+$/.test(trimmed) ? trimmed + '기' : trimmed; }).filter((t) => t);
      const uniqueTags = [...new Set(newTags)];
      try { await updateDoc(doc(db, 'photos', photoId), { tags: uniqueTags }); showToast('태그 업데이트 완료!'); } catch (e) { alert(e.message); }
    }
  };
  const handleUpdateDesc = async (photoId, currentDesc) => {
    const newDesc = prompt('사진 설명을 수정해주세요:', currentDesc);
    if (newDesc !== null && newDesc !== currentDesc) { try { await updateDoc(doc(db, 'photos', photoId), { desc: newDesc }); showToast('수정 완료!'); } catch (e) { alert(e.message); } }
  };
  const handleUpdateYear = async (photoId, currentYear) => {
    const newYear = prompt('촬영 연도(4자리) 입력', currentYear || '');
    if (newYear !== null && newYear !== currentYear) {
      if (!/^\d{4}$/.test(newYear) && newYear !== '') { alert('4자리 숫자로 입력해주세요'); return; }
      try { await updateDoc(doc(db, 'photos', photoId), { photoYear: newYear }); showToast('연도 저장 완료!'); } catch (e) { alert(e.message); }
    }
  };
  const handleDeletePhoto = async (photo) => {
    if (!confirm('정말로 삭제하시겠습니까?')) return;
    setAppLoading(true);
    try {
      await deleteObject(ref(storage, photo.url)).catch((e) => console.log(e));
      await deleteDoc(doc(db, 'photos', photo.id));
      showToast('삭제되었습니다.');
    } catch (e) { alert(e.message); }
    setAppLoading(false);
  };

  // 스와이프
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const onTouchStart = (e) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    if (isDetailViewRef.current) return;
    const distance = touchStart - touchEnd;
    if (distance > 50) { const i = TABS.indexOf(activeTab); if (i < TABS.length - 1) setActiveTab(TABS[i + 1]); }
    if (distance < -50) { const i = TABS.indexOf(activeTab); if (i > 0) setActiveTab(TABS[i - 1]); }
  };

  const [editingPhoto, setEditingPhoto] = useState(null);
  const [savingPhotoId, setSavingPhotoId] = useState(null);

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gray-200 flex justify-center items-center">
        <div className="w-full max-w-[500px] h-[100dvh] bg-white shadow-2xl flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gray-200 flex justify-center items-center">
      <div className="w-full max-w-[500px] h-[100dvh] bg-white shadow-2xl overflow-hidden relative flex flex-col">
        {!user ? (
          <AuthScreen />
        ) : showOnboarding ? (
          <OnboardingScreen onStart={() => setShowOnboarding(false)} />
        ) : (
          <>
            <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex justify-between items-center shrink-0 border-b">
              <h1 className="text-xl font-bold text-blue-900">신우 Photo</h1>
              <button onClick={() => alert('준비중')} className="p-2 text-gray-600"><Share2 size={20} /></button>
            </header>

            <main className="flex-1 overflow-hidden p-0 relative bg-white"
              onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
            >
              {activeTab === 'home' && <HomeTab photos={photos} collections={collections} openSaveModal={setSavingPhotoId} onEditTags={setEditingPhoto} onUpdateDesc={handleUpdateDesc} onUpdateYear={handleUpdateYear} onDelete={handleDeletePhoto} currentUser={user} userData={userData} showToast={showToast} isDetailViewRef={isDetailViewRef} />}
              {activeTab === 'albums' && <AlbumsTab photos={photos} collections={collections} openSaveModal={setSavingPhotoId} isDetailViewRef={isDetailViewRef} createCollection={createCollection} deleteCollection={deleteCollection} />}
              {activeTab === 'members' && <MembersTab members={members} />}
              {activeTab === 'upload' && <UploadTab setActiveTab={setActiveTab} showToast={showToast} userData={userData} setLoading={setAppLoading} />}
              {activeTab === 'mypage' && <MyPageTab userData={userData} collections={collections} renameCollection={renameCollection} />}
            </main>

            <nav className="bg-white border-t flex justify-around items-center h-16 absolute bottom-0 w-full z-30 px-1 shrink-0">
              <NavBtn icon={<Camera />} label="홈" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
              <NavBtn icon={<Users />} label="멤버" active={activeTab === 'members'} onClick={() => setActiveTab('members')} />
              <NavBtn icon={<PlusSquare />} label="업로드" active={activeTab === 'upload'} onClick={() => setActiveTab('upload')} />
              <NavBtn icon={<BookHeart />} label="앨범" active={activeTab === 'albums'} onClick={() => setActiveTab('albums')} />
              <NavBtn icon={<User />} label="내정보" active={activeTab === 'mypage'} onClick={() => setActiveTab('mypage')} />
            </nav>
          </>
        )}

        {appLoading && (<div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center text-white"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mb-2"></div></div>)}
        {savingPhotoId && <SaveCollectionModal photos={photos} photoId={savingPhotoId} collections={collections} toggleCollectionItem={toggleCollectionItem} closeModal={() => setSavingPhotoId(null)} createCollection={createCollection}/>}
        {editingPhoto && <TagEditModal photo={editingPhoto} closeModal={() => setEditingPhoto(null)} showToast={showToast} />}
        {toast && <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-full shadow-lg text-sm animate-bounce z-50 whitespace-nowrap">{toast}</div>}
      </div>
    </div>
  );
}

// --- HomeTab (안전장치 강화) ---
function HomeTab({ photos, collections, openSaveModal, onEditTags, onUpdateDesc, onUpdateYear, onDelete, currentUser, userData, showToast, isDetailViewRef }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [isWideGrid, setIsWideGrid] = useState(false);
  const [sortOption, setSortOption] = useState('upload_desc');

  // ★ [안전장치] p.desc가 없을 경우 빈 문자열로 처리
  const filtered = photos.filter((p) => 
    (p.desc || "").includes(searchTerm) || 
    (p.tags && p.tags.some((t) => t.includes(searchTerm))) || 
    (p.uploader || "").includes(searchTerm)
  );

  const sortedPhotos = [...filtered].sort((a, b) => {
    switch (sortOption) {
      case 'upload_desc': return (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0);
      case 'upload_asc': return (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0);
      case 'year_desc': return (Number(b.photoYear) || 0) - (Number(a.photoYear) || 0);
      case 'year_asc': { const ya = a.photoYear ? Number(a.photoYear) : 9999; const yb = b.photoYear ? Number(b.photoYear) : 9999; return ya - yb; }
      case 'random': return 0.5 - Math.random();
      default: return 0;
    }
  });

  useEffect(() => {
    if (selectedPhoto) {
      isDetailViewRef.current = true;
      const updated = photos.find((p) => p.id === selectedPhoto.id);
      if (updated) setSelectedPhoto(updated); else setSelectedPhoto(null);
    } else { isDetailViewRef.current = false; }
  }, [photos, selectedPhoto]);

  const isAdmin = userData?.role === 'admin';
  const isMyPost = selectedPhoto && currentUser && selectedPhoto.uploaderId === currentUser.uid;

  if (selectedPhoto) {
    return (
      <PageLayout>
        <div className="p-3 border-b flex items-center justify-between sticky top-0 bg-white z-20 shadow-sm">
          <div className="flex items-center gap-3"><button onClick={() => setSelectedPhoto(null)} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft size={24} className="text-gray-700" /></button><span className="font-bold text-lg truncate">사진 상세</span></div>
          {(isMyPost || isAdmin) && (<button onClick={() => onDelete(selectedPhoto)} className="p-2 text-red-500 hover:bg-red-50 rounded-full"><Trash2 size={20} /></button>)}
        </div>
        <ScrollContent type="list" className="relative">
          <div className="w-full bg-black flex items-center justify-center"><img src={selectedPhoto.url} className="w-full h-auto max-h-[60vh] object-contain" /></div>
          <div className="p-5 border-b">
            <div className="flex justify-between items-start mb-4"><div className="flex-1 mr-2"><div className="flex items-center gap-2 mb-1"><h2 className="text-xl font-bold text-gray-900">{selectedPhoto.desc}</h2><button onClick={() => onUpdateDesc(selectedPhoto.id, selectedPhoto.desc)} className="text-gray-400 hover:text-blue-600 p-1"><Edit2 size={16} /></button></div><div className="text-sm text-gray-500 flex items-center flex-wrap gap-2"><span>By {selectedPhoto.uploader}</span><span className="text-gray-300">|</span><div className="flex items-center gap-1 group cursor-pointer" onClick={() => onUpdateYear(selectedPhoto.id, selectedPhoto.photoYear)}><Calendar size={14} className="text-gray-400" /><span className={`${selectedPhoto.photoYear ? 'text-gray-700' : 'text-gray-400 italic'}`}>{selectedPhoto.photoYear ? `${selectedPhoto.photoYear}년` : '연도 미상'}</span><Edit2 size={10} className="opacity-50 group-hover:opacity-100 text-blue-500" /></div></div></div></div>
            <div className="mb-6"><div className="flex flex-wrap gap-2 mb-2">{selectedPhoto.tags && selectedPhoto.tags.map((tag, i) => (<span key={i} className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-sm font-medium border border-blue-100">{formatTag(tag)}</span>))}</div><button onClick={() => onEditTags(selectedPhoto)} className="text-sm text-gray-500 flex items-center gap-1 hover:text-blue-600"><Plus size={14} /> 태그(기수) 추가</button></div>
            <div className="flex gap-3"><button onClick={() => openSaveModal(selectedPhoto.id)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-sm flex items-center justify-center gap-2"><Heart size={20} className={collections.some((col) => col.photoIds.includes(selectedPhoto.id)) ? 'fill-red-500 text-red-500' : ''} /> 앨범담기</button></div>
          </div>
          <CommentSection photoId={selectedPhoto.id} currentUser={currentUser} userData={userData} showToast={showToast} />
        </ScrollContent>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="p-3 border-b sticky top-0 bg-white z-10 flex flex-col gap-2">
        <div className="relative w-full"><input className="w-full p-2 pl-9 border rounded-lg text-sm bg-gray-50 outline-none focus:ring-1 focus:ring-blue-200" placeholder="검색 (이름, 기수)" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /><div className="absolute left-3 top-2.5 text-gray-400">🔍</div></div>
        <div className="flex justify-between items-center"><select className="text-xs font-bold bg-gray-50 border rounded-lg px-2 py-1.5 outline-none text-gray-600" value={sortOption} onChange={(e) => setSortOption(e.target.value)}><option value="upload_desc">최근 게시물</option><option value="upload_asc">과거 게시물</option><option value="year_desc">최근 촬영일</option><option value="year_asc">과거 촬영일</option><option value="random">랜덤 추억</option></select><button onClick={() => setIsWideGrid(!isWideGrid)} className="text-xs bg-gray-50 border rounded-lg px-3 py-1.5 text-gray-500 hover:bg-gray-100">{isWideGrid ? '크게' : '작게'}</button></div>
      </div>
      <ScrollContent type="list">
        <div className={`grid gap-0.5 ${isWideGrid ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {sortedPhotos.map((p) => (
            <div key={p.id} onClick={() => setSelectedPhoto(p)} className="aspect-square cursor-pointer relative overflow-hidden group">
              <img src={p.url} className="w-full h-full object-cover" />
              {p.commentsCount > 0 && <div className="absolute top-1 right-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1"><MessageCircle size={10} /> {p.commentsCount}</div>}
              {p.photoYear && <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[10px] px-1.5 rounded backdrop-blur-sm">{p.photoYear}</div>}
            </div>
          ))}
        </div>
      </ScrollContent>
    </PageLayout>
  );
}

function CommentSection({ photoId, currentUser, userData, showToast }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "comments"), where("photoId", "==", photoId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setComments(list);
      updateDoc(doc(db, "photos", photoId), { commentsCount: list.length }).catch(()=>{});
    });
    return () => unsubscribe();
  }, [photoId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      await addDoc(collection(db, "comments"), {
        photoId, text: newComment, writer: userData.name, writerId: currentUser.uid, writerGisu: userData.gisu, createdAt: serverTimestamp(), likes: [], parentId: replyingTo ? replyingTo.id : null
      });
      setNewComment(""); setReplyingTo(null);
    } catch (e) { alert("오류: " + e.message); }
  };

  const handleDelete = async (commentId) => { if (!confirm("삭제하시겠습니까?")) return; await deleteDoc(doc(db, "comments", commentId)); };
  const handleLike = async (comment) => {
    const isLiked = comment.likes?.includes(currentUser.uid);
    const commentRef = doc(db, "comments", comment.id);
    if (isLiked) await updateDoc(commentRef, { likes: arrayRemove(currentUser.uid) });
    else await updateDoc(commentRef, { likes: arrayUnion(currentUser.uid) });
  };

  const rootComments = comments.filter(c => !c.parentId);
  const getReplies = (parentId) => comments.filter(c => c.parentId === parentId);
  const CommentItem = ({ comment, isReply = false }) => (
    <div className={`flex gap-3 mb-3 ${isReply ? 'pl-10' : ''}`}>
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0 border">{comment.writer[0]}</div>
      <div className="flex-1"><div className="bg-gray-50 p-3 rounded-xl rounded-tl-none text-sm"><div className="flex justify-between items-center mb-1"><span className="font-bold text-gray-800">{comment.writer} <span className="text-xs text-gray-400 font-normal">{comment.writerGisu}기</span></span><span className="text-[10px] text-gray-400">{formatDate(comment.createdAt)}</span></div><p className="text-gray-700 whitespace-pre-wrap">{comment.text}</p></div><div className="flex gap-3 mt-1 pl-2 text-xs text-gray-500"><button onClick={() => handleLike(comment)} className={`flex items-center gap-1 ${comment.likes?.includes(currentUser.uid) ? 'text-red-500 font-bold' : ''}`}><ThumbsUp size={12} /> {comment.likes?.length > 0 && comment.likes.length}</button>{!isReply && (<button onClick={() => setReplyingTo(comment)}>답글</button>)}{(comment.writerId === currentUser.uid || userData?.role === 'admin') && (<button onClick={() => handleDelete(comment.id)} className="text-red-400">삭제</button>)}</div></div>
    </div>
  );

  return (
    <div className="border-t bg-white">
      <div className="p-4 pb-24">
        <h3 className="font-bold text-gray-800 mb-4 text-sm flex items-center gap-2"><MessageCircle size={16}/> 댓글 {comments.length}</h3>
        <div className="space-y-2 mb-4">{rootComments.map(root => (<div key={root.id}><CommentItem comment={root} />{getReplies(root.id).map(reply => (<div key={reply.id} className="relative"><div className="absolute left-4 top-0 bottom-6 w-4 border-l-2 border-b-2 border-gray-100 rounded-bl-xl"></div><CommentItem comment={reply} isReply={true} /></div>))}</div>))}{comments.length === 0 && <p className="text-center text-gray-400 text-xs py-4">첫 댓글을 남겨보세요!</p>}</div>
      </div>
      <div className="absolute bottom-0 w-full bg-white border-t p-3 z-10 flex flex-col">
        {replyingTo && (<div className="flex justify-between items-center bg-blue-50 px-3 py-2 rounded-lg mb-2 text-xs"><span className="text-blue-600 font-bold">@{replyingTo.writer}님에게 답글</span><button onClick={() => setReplyingTo(null)}><X size={14}/></button></div>)}
        <form onSubmit={handleSubmit} className="flex gap-2"><input className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100" placeholder="댓글을 입력하세요..." value={newComment} onChange={e => setNewComment(e.target.value)} /><button type="submit" disabled={!newComment.trim()} className="bg-blue-600 text-white p-2 rounded-full disabled:bg-gray-300"><Send size={18} className="ml-0.5"/></button></form>
      </div>
    </div>
  );
}

function GisuInput({ tags, setTags }) {
  const [input, setInput] = useState("");
  const addGisu = () => { if (!input) return; const newTag = /^\d+$/.test(input) ? `${input}기` : input; if (!tags.includes(newTag)) setTags([...tags, newTag]); setInput(""); };
  return (
    <div className="space-y-2">
      <div className="flex gap-2"><input type="number" pattern="[0-9]*" inputMode="numeric" className="flex-1 border p-3 rounded-lg bg-gray-50 outline-none focus:bg-white" placeholder="기수 (숫자만)" value={input} onChange={e => setInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && addGisu()}/><button onClick={addGisu} className="bg-blue-600 text-white px-4 rounded-lg font-bold shrink-0">추가</button></div>
      <div className="flex flex-wrap gap-2 min-h-[40px] p-3 bg-gray-50 rounded-lg border border-dashed border-gray-200">{tags.length === 0 && <span className="text-gray-400 text-xs py-1">입력된 기수가 없습니다.</span>}{tags.map((tag, i) => (<span key={i} className="bg-white text-blue-600 border border-blue-200 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 shadow-sm">{formatTag(tag)}<button onClick={() => setTags(tags.filter(t => t !== tag))} className="text-gray-400 hover:text-red-500"><X size={14}/></button></span>))}</div>
    </div>
  );
}

function TagEditModal({ photo, closeModal, showToast }) {
  const [tags, setTags] = useState(photo.tags || []);
  const handleSave = async () => { try { await updateDoc(doc(db, "photos", photo.id), { tags: tags }); showToast("수정 완료!"); closeModal(); } catch (e) { alert("실패: " + e.message); } };
  return ( <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"><div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"><div className="p-4 border-b flex justify-between items-center bg-white"><h3 className="font-bold text-lg">기수 수정</h3><button onClick={closeModal}><X size={24} className="text-gray-500"/></button></div><div className="p-5 space-y-4"><div className="flex items-center gap-3 mb-2"><img src={photo.url} className="w-16 h-16 object-cover rounded-lg border" /><div><p className="font-bold text-sm truncate w-40">{photo.desc}</p></div></div><GisuInput tags={tags} setTags={setTags} /><button onClick={handleSave} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-lg mt-2">저장하기</button></div></div></div> );
}

function UploadTab({ setActiveTab, showToast, userData, setLoading }) {
  const [desc, setDesc] = useState(""); const [photoYear, setPhotoYear] = useState(""); const [tags, setTags] = useState([]); const [file, setFile] = useState(null); const [preview, setPreview] = useState(null);
  useEffect(() => { if (userData && tags.length === 0) setTags([`${userData.gisu}기`]); }, [userData, tags.length]);
  const handleUpload = async () => {
    if (!file || !desc) return alert('사진과 설명을 입력해주세요.');
    try { setLoading(true); const fileRef = ref(storage, `photos/${Date.now()}_${file.name}`); await uploadBytes(fileRef, file); const url = await getDownloadURL(fileRef); const defaultTags = [`${userData.gisu}기`, userData.name]; const finalTags = [...new Set([...tags, ...defaultTags])]; await addDoc(collection(db, 'photos'), { url, desc, tags: finalTags, photoYear, uploader: userData.name, uploaderId: auth.currentUser.uid, timestamp: serverTimestamp(), commentsCount: 0 }); setLoading(false); showToast('게시 완료!'); setActiveTab('home'); } catch (e) { setLoading(false); alert(e.message); }
  };
  return (
    <PageLayout>
      <ScrollContent type="form">
        <div className="border-2 border-dashed border-gray-200 bg-gray-50 rounded-2xl h-64 mb-6 flex flex-col items-center justify-center relative overflow-hidden hover:border-blue-300 transition-colors">
          {preview ? <img src={preview} className="w-full h-full object-contain" /> : <div className="text-center text-gray-400"><Camera size={48} className="mx-auto mb-2 opacity-30" /><p className="text-sm font-medium">사진을 선택해주세요</p></div>}
          <input type="file" accept="image/*" onChange={(e) => { if (e.target.files[0]) { setFile(e.target.files[0]); setPreview(URL.createObjectURL(e.target.files[0])); } }} className="absolute inset-0 opacity-0 cursor-pointer" />
        </div>
        <div className="space-y-5">
          <div><label className="block font-bold text-gray-800 mb-2 text-sm">사진 설명</label><input className="w-full border border-gray-200 p-3.5 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="어떤 순간인가요?" /></div>
          <div><label className="block font-bold text-gray-800 mb-2 text-sm">촬영 연도 <span className="text-gray-400 font-normal">(선택)</span></label><input type="number" pattern="[0-9]*" inputMode="numeric" className="w-full border border-gray-200 p-3.5 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all" value={photoYear} onChange={(e) => setPhotoYear(e.target.value)} placeholder="예: 1995" /></div>
          <div><label className="block font-bold text-gray-800 mb-2 text-sm">등장 기수 <span className="text-gray-400 font-normal">(함께 채워가요!)</span></label><GisuInput tags={tags} setTags={setTags} /></div>
        </div>
        <div className="bg-blue-50 p-4 rounded-xl mt-6 mb-8 text-xs text-blue-800 flex gap-3 items-start"><span className="text-lg">💡</span><p>기수나 이름을 몰라도 괜찮아요. 나중에 다른 동문들이 댓글이나 태그 수정으로 알려줄 거예요!</p></div>
        <button onClick={handleUpload} className="w-full bg-blue-900 text-white p-4 rounded-xl font-bold text-lg shadow-lg hover:bg-blue-800 active:scale-95 transition-all">게시하기</button>
      </ScrollContent>
    </PageLayout>
  );
}

function OnboardingScreen({ onStart }) { return ( <div className="h-full w-full bg-white flex flex-col items-center justify-center p-8 relative"><div className="flex-1 flex flex-col justify-center items-center text-center space-y-8"><div><img src="/logo.jpg" className="w-24 h-auto mx-auto mb-4 animate-bounce" /><h1 className="text-2xl font-bold text-blue-900 mb-2">환영합니다!</h1><p className="text-gray-500">신우 동문들을 위한<br/>추억 저장소입니다.</p></div><button onClick={onStart} className="w-full bg-blue-900 text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 hover:bg-blue-800 mt-6">시작하기 <ArrowLeft className="rotate-180"/></button></div></div> ); }
function AuthScreen() { const [isLoginMode, setIsLoginMode] = useState(true); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState(""); const [gisu, setGisu] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false); const handleAuth = async () => { setError(""); setLoading(true); try { if (isLoginMode) { await signInWithEmailAndPassword(auth, email, password); } else { if(!name || !gisu) throw new Error("이름과 기수를 입력해주세요."); const userCredential = await createUserWithEmailAndPassword(auth, email, password); await setDoc(doc(db, "users", userCredential.user.uid), { name, gisu, email, role: 'user', joinedAt: serverTimestamp() }); } } catch (err) { setError("로그인 실패: " + err.message); } setLoading(false); }; const bgImageUrl = "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop"; return ( <div className="h-full w-full flex flex-col items-center justify-center bg-gray-900 bg-cover bg-center relative before:absolute before:inset-0 before:bg-black/50" style={{ backgroundImage: `url(${bgImageUrl})` }}><div className="bg-black/70 p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center backdrop-blur-md border border-white/10 z-10 mx-4"><div className="mb-6 flex justify-center"><img src="/logo.jpg" alt="신우 로고" className="w-40 h-auto object-contain" /></div><h1 className="text-3xl font-bold text-white mb-2 font-serif">신우 Photo</h1><div className="space-y-3"><input className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 outline-none" placeholder="이메일" value={email} onChange={e=>setEmail(e.target.value)}/><input type="password" className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 outline-none" placeholder="비밀번호" value={password} onChange={e=>setPassword(e.target.value)}/>{!isLoginMode && (<><input className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 outline-none" placeholder="이름" value={name} onChange={e=>setName(e.target.value)}/><input className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 outline-none" placeholder="기수" value={gisu} onChange={e=>setGisu(e.target.value)}/></>)}</div>{error && <p className="text-red-400 mt-3">{error}</p>}<button onClick={handleAuth} disabled={loading} className="w-full mt-6 bg-yellow-600 hover:bg-yellow-500 text-white p-3 rounded-xl font-bold shadow-lg">{isLoginMode ? "로그인" : "가입하기"}</button><div className="mt-4 flex justify-center gap-2 text-sm"><span className="text-gray-400">{isLoginMode ? "계정이 없으신가요?" : "계정이 있으신가요?"}</span><button onClick={() => {setIsLoginMode(!isLoginMode); setError("");}} className="text-yellow-500 font-bold hover:underline">{isLoginMode ? "회원가입" : "로그인"}</button></div></div></div> ); }
function MyPageTab({ userData, collections, renameCollection }) { if (!userData) return null; return ( <PageLayout><ScrollContent type="form"><div className="flex flex-col items-center pt-10 pb-8 border-b border-gray-100"><div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-blue-50 rounded-full mb-4 flex items-center justify-center text-4xl shadow-inner">😎</div><div className="flex flex-col items-center"><div className="flex items-center gap-2"><h2 className="text-2xl font-bold text-gray-900">{userData.name}</h2><span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${userData.role === 'admin' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{userData.role === 'admin' ? '관리자' : `${userData.gisu}기`}</span></div><p className="text-sm text-gray-400 mt-1">{userData.email}</p></div><button onClick={() => confirm("로그아웃 하시겠습니까?") && signOut(auth)} className="mt-6 text-xs text-gray-400 border border-gray-200 px-4 py-1.5 rounded-full flex items-center gap-1 hover:bg-gray-50 transition-colors"><LogOut size={12}/> 로그아웃</button></div><div className="p-0 mt-8"><h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2 px-1"><BookHeart size={20} className="text-red-400"/> 나의 앨범</h3><div className="space-y-3">{collections.map(col => (<div key={col.id} className="bg-gray-50 p-4 rounded-xl flex items-center justify-between group hover:bg-blue-50 transition-colors"><div><input className="font-bold text-gray-700 bg-transparent border-none w-40 focus:ring-0 p-0" value={col.name} onChange={(e) => renameCollection(col.id, e.target.value)} /><p className="text-xs text-gray-400 mt-1">{col.photoIds.length}장의 사진</p></div><Edit2 size={16} className="text-gray-300 group-hover:text-blue-400" /></div>))}</div></div></ScrollContent></PageLayout> ); }
function AlbumsTab({ photos, collections, openSaveModal, isDetailViewRef, createCollection, deleteCollection }) { const [activeAlbumId, setActiveAlbumId] = useState(null); const [selectedPhoto, setSelectedPhoto] = useState(null); useEffect(() => { isDetailViewRef.current = !!activeAlbumId; }, [activeAlbumId, isDetailViewRef]); useEffect(() => { if (!collections.length) setActiveAlbumId(null); }, [collections]); const activeAlbum = collections.find((c) => c.id === activeAlbumId) || null; const albumPhotos = activeAlbum ? photos.filter((p) => (activeAlbum.photoIds || []).includes(p.id)) : [];
  if (!activeAlbumId) return ( <PageLayout><div className="p-4"><h2 className="font-bold text-lg mb-4 text-gray-700">📂 나의 앨범</h2><div className="grid grid-cols-2 gap-4">{collections.map((col) => (<button key={col.id} onClick={() => setActiveAlbumId(col.id)} className="bg-gray-50 p-4 rounded-xl border flex flex-col items-center justify-center h-40 active:scale-95 transition-transform hover:bg-blue-50 relative group"><FolderPlus size={32} className="text-yellow-600 mb-3" /><span className="font-bold text-gray-800 truncate w-full text-center">{col.name}</span><span className="text-xs text-gray-500">{col.photoIds.length}장</span>{!col.isDefault && (<div onClick={(e) => { e.stopPropagation(); deleteCollection(col.id, col.isDefault); }} className="absolute top-2 right-2 text-gray-300 hover:text-red-500 p-1"><Trash2 size={16} /></div>)}</button>))}<button onClick={() => createCollection('새 앨범')} className="border-2 border-dashed border-gray-300 p-4 rounded-xl flex flex-col items-center justify-center h-40 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"><Plus size={32} className="mb-2" /><span className="text-sm font-bold">새 앨범 만들기</span></button></div>{collections.length === 0 && <div className="text-center text-gray-400 py-20">아직 앨범이 없습니다.</div>}</div></PageLayout> );
  if (selectedPhoto) return ( <PageLayout><div className="p-3 border-b flex items-center gap-3 sticky top-0 bg-white z-20 shadow-sm"><button onClick={() => setSelectedPhoto(null)} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft size={24} className="text-gray-700"/></button><span className="font-bold text-lg truncate">앨범: {activeAlbum.name}</span></div><ScrollContent type="list"><div className="w-full bg-black flex items-center justify-center"><img src={selectedPhoto.url} className="w-full h-auto max-h-[70vh] object-contain" /></div><div className="p-5"><div className="flex justify-between items-start mb-4"><div><h2 className="text-xl font-bold text-gray-900">{selectedPhoto.desc}</h2><p className="text-sm text-gray-500">Posted by {selectedPhoto.uploader}</p></div></div><div className="mb-6 flex flex-wrap gap-2">{selectedPhoto.tags && selectedPhoto.tags.map((tag, i) => (<span key={i} className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-sm font-medium border border-blue-100">{formatTag(tag)}</span>))}</div></div></ScrollContent></PageLayout> );
  return ( <PageLayout><div className="bg-white p-3 sticky top-0 z-20 shadow-sm flex items-center gap-2 shrink-0"><button onClick={() => setActiveAlbumId(null)} className="p-1 hover:bg-gray-100 rounded-full"><ArrowLeft size={24} className="text-gray-700" /></button><span className="font-bold text-lg text-blue-900 truncate max-w-[200px]">{activeAlbum.name}</span></div><ScrollContent type="list">{albumPhotos.length === 0 ? (<div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm"><p>이 앨범은 비어있습니다.</p><p className="mt-1">홈에서 사진을 담아보세요!</p></div>) : (<div className="grid grid-cols-3 gap-0.5">{albumPhotos.map((p) => (<div key={p.id} onClick={() => setSelectedPhoto(p)} className="aspect-square relative cursor-pointer"><img src={p.url} className="w-full h-full object-cover" /></div>))}</div>)}</ScrollContent></PageLayout> );
}
function SaveCollectionModal({ photoId, collections, toggleCollectionItem, closeModal, createCollection }) { const [newColName, setNewColName] = useState(""); const [isCreating, setIsCreating] = useState(false); return ( <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"><div className="bg-white w-full max-w-sm rounded-xl overflow-hidden shadow-2xl"><div className="p-4 border-b flex justify-between items-center"><h3 className="font-bold">어디에 담을까요?</h3><button onClick={closeModal}><X size={20}/></button></div><div className="max-h-60 overflow-y-auto p-2">{collections.map(col => (<button key={col.id} onClick={() => toggleCollectionItem(col.id, photoId)} className={`w-full text-left p-3 rounded-lg mb-1 flex justify-between items-center ${col.photoIds.includes(photoId) ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}`}><span className="font-medium">{col.name}</span>{col.photoIds.includes(photoId) && <Check size={18}/>}</button>))}</div><div className="p-3 border-t bg-gray-50">{isCreating ? (<div className="flex gap-2"><input autoFocus className="flex-1 border p-2 rounded text-sm" placeholder="새 폴더 이름" value={newColName} onChange={e => setNewColName(e.target.value)} /><button onClick={() => { createCollection(newColName); setIsCreating(false); setNewColName(""); }} className="bg-blue-600 text-white px-3 rounded text-sm font-bold">확인</button></div>) : (<button onClick={() => setIsCreating(true)} className="w-full py-2 text-blue-600 text-sm font-bold flex items-center justify-center gap-1"><Plus size={16}/> 새 폴더 만들기</button>)}</div></div></div> ); }
function NavBtn({ icon, label, active, onClick }) { return ( <button onClick={onClick} className={`flex flex-col items-center justify-center flex-1 min-w-0 ${active ? 'text-blue-600' : 'text-gray-400'}`}>{React.cloneElement(icon, { size: 22 })}<span className="text-[10px] mt-1 font-bold whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">{label}</span></button> ); }
function MembersTab({ members }) { const [search, setSearch] = useState(""); return ( <PageLayout><div className="p-4 sticky top-0 bg-white z-10 border-b"><input className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-100" placeholder="이름 검색" value={search} onChange={e => setSearch(e.target.value)}/></div><ScrollContent type="list"><ul className="bg-white divide-y">{members.filter(m => m.name.includes(search)).map(m => (<li key={m.id} className="p-4 flex gap-4 items-center hover:bg-gray-50 transition-colors"><div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold">👤</div><div><p className="font-bold text-gray-800">{m.name}</p><span className="text-xs text-white bg-gray-400 px-2 py-0.5 rounded-full">{m.gisu}기</span></div></li>))}</ul></ScrollContent></PageLayout> ); }