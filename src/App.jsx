import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Camera, Users, PlusSquare, User, Share2, Heart,
  Edit2, Check, X, Plus, BookHeart, LogOut,
  ArrowLeft, Calendar, Trash2, MessageCircle, Send, ThumbsUp,
  Grid, LayoutGrid, Maximize2, Download, Shield, FolderPlus,
  Trophy, Crown, Eye, List, FolderX, ChevronRight, Info, Folder, UserCog, ArrowUpDown, Tag, Link as LinkIcon
} from 'lucide-react';

import { db, storage, auth } from './firebase';
import {
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp,
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  arrayUnion, arrayRemove, where, increment
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';

// --- 버전 정보 ---
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'Dev Mode';

// --- 상수 ---
const POINTS = { UPLOAD: 100, RX_COMMENT: 10, WR_COMMENT: 20, RX_HEART: 3, GV_HEART: 5, TAG_EDIT: 20 };

// --- 유틸리티 ---
const formatTag = (tag) => {
  if (!tag) return "";
  return /^\d+$/.test(tag) ? tag + '기' : tag;
};
const formatDate = (timestamp) => {
  if (!timestamp || !timestamp.seconds) return '';
  try {
    const date = new Date(timestamp.seconds * 1000);
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
  } catch (e) { return ''; }
};

// 태그 정렬기 (숫자 우선)
const sortTagsSmart = (tags) => {
  if (!tags || !Array.isArray(tags)) return [];
  return [...tags].sort((a, b) => {
    const numA = parseInt(a.replace(/[^0-9]/g, ""), 10);
    const numB = parseInt(b.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    if (!isNaN(numA)) return -1;
    if (!isNaN(numB)) return 1;
    return a.localeCompare(b);
  });
};

// 실시간 통계 계산
const calculateRealtimeStats = (photos) => {
  const stats = {};
  if (!photos || !Array.isArray(photos)) return stats;
  photos.forEach(p => {
    const uid = p.uploaderId;
    if (uid) {
      if (!stats[uid]) stats[uid] = { upload: 0, rxHeart: 0, rxComment: 0 };
      stats[uid].upload += 1;
      stats[uid].rxHeart += ((p.likes || []).length);
      stats[uid].rxComment += (p.commentsCount || 0);
    }
  });
  return stats;
};

// 유저 점수 계산
const calculateUserScore = (userDoc, stats) => {
  if (!userDoc) return 0;
  const s = stats[userDoc.id] || { upload: 0, rxHeart: 0, rxComment: 0 };
  return (s.upload * POINTS.UPLOAD) + 
         (s.rxHeart * POINTS.RX_HEART) + 
         (s.rxComment * POINTS.RX_COMMENT) + 
         ((userDoc.commentCount || 0) * POINTS.WR_COMMENT) + 
         ((userDoc.givenHeartCount || 0) * POINTS.GV_HEART) +
         ((userDoc.tagEditCount || 0) * POINTS.TAG_EDIT);
};

// --- 공통 레이아웃 ---
const PageLayout = ({ children, className = "" }) => (
  <div className={`flex-1 w-full h-full bg-white flex flex-col overflow-hidden relative ${className}`}>
    {children}
  </div>
);

const ScrollContent = ({ children, type = 'list' }) => {
  const paddingClass = type === 'form' ? 'px-5 pt-5 pb-24' : 'pb-20';
  return (
    <div className={`flex-1 w-full h-full overflow-y-auto ${paddingClass}`}>
      {children}
    </div>
  );
};

// 로딩 스피너
const LoadingSpinner = ({ msg = "로딩중..." }) => (
  <div className="flex h-full w-full items-center justify-center flex-col gap-4">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
    <p className="text-gray-400 text-sm font-medium">{msg}</p>
  </div>
);

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
  
  const [activeAlbumId, setActiveAlbumId] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  
  const [toast, setToast] = useState(null);
  const [appLoading, setAppLoading] = useState(false);

  const [editingPhoto, setEditingPhoto] = useState(null);
  const [savingPhotoId, setSavingPhotoId] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // 딥링크 초기화
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const photoId = params.get('photoId');
    if (photoId) {
      sessionStorage.setItem('pendingPhotoId', photoId);
      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  // 딥링크 실행
  useEffect(() => {
    if (user && photos.length > 0) {
      const pendingPhotoId = sessionStorage.getItem('pendingPhotoId');
      if (pendingPhotoId) {
        const targetPhoto = photos.find(p => p.id === pendingPhotoId);
        if (targetPhoto) {
          handleOpenDetail(targetPhoto);
          showToast("공유받은 사진을 열었습니다! 🎁");
        }
        sessionStorage.removeItem('pendingPhotoId');
      }
    }
  }, [user, photos]);

  // 뒤로가기 처리
  useEffect(() => {
    const handlePopState = (event) => {
      if (selectedPhoto) setSelectedPhoto(null);
      else if (activeAlbumId) setActiveAlbumId(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedPhoto, activeAlbumId]);

  // 데이터 로딩 (자가 치유 로직)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setUserData({ ...docSnap.data(), id: currentUser.uid });
          setUser(currentUser);
          setShowOnboarding(true);
        } else {
          console.log("DB 정보 없음. 강제 로그아웃 실행.");
          await signOut(auth);
          setUser(null);
          setUserData(null);
          alert("회원 정보가 초기화되었습니다. 다시 가입해주세요.");
        }
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
    const q = query(collection(db, 'photos'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPhotos(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      setMembers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) { setCollections([]); return; }
    const q = query(collection(db, 'albums'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        try { await addDoc(collection(db, 'albums'), { userId: user.uid, name: '♥ 기본 앨범', photoIds: [], createdAt: serverTimestamp(), isDefault: true }); } catch (e) {}
        return;
      }
      const list = snapshot.docs.map((d) => ({ id: d.id, photoIds: d.data().photoIds || [], ...d.data() }));
      list.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setCollections(list);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    isDetailViewRef.current = !!selectedPhoto || (activeTab === 'albums' && !!activeAlbumId);
  }, [selectedPhoto, activeAlbumId, activeTab]);

  // --- 기능 함수들 ---
  const handleOpenAlbum = (albumId, fromTab = null) => {
    window.history.pushState({ modal: 'album' }, ''); 
    setActiveAlbumId(albumId);
    setActiveTab('albums');
  };

  const handleOpenDetail = async (photo) => {
    window.history.pushState({ modal: 'photo' }, '');
    setSelectedPhoto(photo);
    try { await updateDoc(doc(db, "photos", photo.id), { viewCount: increment(1) }); } catch (e) {}
  };

  const handleClosePopup = () => {
    window.history.back(); 
  };

  const handleShareApp = async () => {
    const shareData = { title: '신우 Photo', text: '동문들을 위한 추억 저장소입니다. 함께해요!', url: window.location.origin };
    try { if (navigator.share) await navigator.share(shareData); else { await navigator.clipboard.writeText(shareData.url); showToast("주소가 복사되었습니다!"); } } catch (e) { console.log('Share closed'); }
  };

  const handleSharePhoto = async (photo) => {
    const shareData = { title: '신우 Photo', text: `[신우 Photo] ${photo.desc || '추억을 공유합니다!'}`, url: `${window.location.origin}/?photoId=${photo.id}` };
    try { if (navigator.share) await navigator.share(shareData); else { await navigator.clipboard.writeText(shareData.url); showToast("사진 링크가 복사되었습니다!"); } } catch (e) { console.log('Share closed'); }
  };

  const createCollection = async () => {
    if (!user) return;
    let albumName = "새 앨범";
    let isValid = false;
    while (!isValid) {
      albumName = prompt("새 앨범 이름을 입력해주세요:", albumName);
      if (albumName === null) return;
      if (!albumName.trim()) { alert("이름을 입력해주세요."); continue; }
      if (collections.some(c => c.name === albumName)) { alert("이미 같은 이름의 앨범이 있습니다."); continue; }
      isValid = true;
    }
    try { await addDoc(collection(db, 'albums'), { userId: user.uid, name: albumName, photoIds: [], createdAt: serverTimestamp(), isDefault: false }); showToast(`'${albumName}' 생성 완료!`); } catch (e) { alert(e.message); }
  };

  const renameCollection = async (id, newName) => { try { await updateDoc(doc(db, 'albums', id), { name: newName }); showToast('이름 변경 완료'); } catch (e) { alert(e.message); } };
  
  const toggleCollectionItem = async (colId, pId) => {
    const col = collections.find((c) => c.id === colId); if (!col) return;
    const albumRef = doc(db, 'albums', colId);
    const isIncluded = (col.photoIds || []).includes(pId);
    const newPhotoIds = isIncluded ? col.photoIds.filter(id => id !== pId) : [...(col.photoIds || []), pId];
    setCollections(prev => prev.map(c => c.id === colId ? { ...c, photoIds: newPhotoIds } : c));
    if (!isIncluded) showToast(`'${col.name}'에 저장되었습니다! 💾`); else showToast(`'${col.name}'에서 제외되었습니다.`);
    try { await updateDoc(albumRef, { photoIds: isIncluded ? arrayRemove(pId) : arrayUnion(pId) }); } catch (e) { alert("저장 실패: " + e.message); setCollections(prev => prev.map(c => c.id === colId ? { ...c, photoIds: col.photoIds } : c)); }
  };

  const deleteCollection = async (id, isDefault) => {
    if (isDefault) { alert('기본 앨범은 삭제 불가'); return; }
    if (!confirm('앨범을 삭제하시겠습니까?')) return;
    try { await deleteDoc(doc(db, 'albums', id)); showToast('앨범 삭제 완료'); } catch (e) { alert(e.message); }
  };

  const handlePhotoLike = async (photo) => {
    if (!user) return;
    const isLiked = (photo.likes || []).includes(user.uid);
    const photoRef = doc(db, 'photos', photo.id);
    const userRef = doc(db, 'users', user.uid);
    const newLikes = isLiked ? (photo.likes || []).filter(id => id !== user.uid) : [...(photo.likes || []), user.uid];
    setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, likes: newLikes } : p));
    if (selectedPhoto && selectedPhoto.id === photo.id) { setSelectedPhoto(prev => ({ ...prev, likes: newLikes })); }
    try { if (isLiked) { await updateDoc(photoRef, { likes: arrayRemove(user.uid) }); await updateDoc(userRef, { givenHeartCount: increment(-1) }); } else { await updateDoc(photoRef, { likes: arrayUnion(user.uid) }); await updateDoc(userRef, { givenHeartCount: increment(1) }); } } catch (e) { console.error(e); setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, likes: photo.likes } : p)); }
  };

  const handleTagSave = async (photo, newTags) => {
    const sortedTags = sortTagsSmart(newTags);
    const oldTags = sortTagsSmart(photo.tags || []);
    if (JSON.stringify(sortedTags) === JSON.stringify(oldTags)) { showToast("변경사항이 없습니다."); return; }
    setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, tags: sortedTags } : p));
    if (selectedPhoto && selectedPhoto.id === photo.id) { setSelectedPhoto(prev => ({ ...prev, tags: sortedTags })); }
    setEditingPhoto(null);
    showToast(`태그 저장 완료! (+${POINTS.TAG_EDIT}점)`);
    try { await updateDoc(doc(db, 'photos', photo.id), { tags: sortedTags }); await updateDoc(doc(db, 'users', user.uid), { tagEditCount: increment(1) }); } catch (e) { alert(e.message); }
  };

  const handleUpdateDesc = async (photoId, currentDesc) => { const newDesc = prompt('사진 설명을 수정해주세요:', currentDesc); if (newDesc !== null && newDesc !== currentDesc) { setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, desc: newDesc } : p)); if (selectedPhoto && selectedPhoto.id === photoId) { setSelectedPhoto(prev => ({ ...prev, desc: newDesc })); } try { await updateDoc(doc(db, 'photos', photoId), { desc: newDesc }); showToast('수정 완료!'); } catch (e) { alert(e.message); } } };
  const handleUpdateYear = async (photoId, currentYear) => { const newYear = prompt('촬영 연도(4자리) 입력', currentYear || ''); if (newYear !== null && newYear !== currentYear) { if (!/^\d{4}$/.test(newYear) && newYear !== '') { alert('4자리 숫자로 입력해주세요'); return; } setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, photoYear: newYear } : p)); if (selectedPhoto && selectedPhoto.id === photoId) { setSelectedPhoto(prev => ({ ...prev, photoYear: newYear })); } try { await updateDoc(doc(db, 'photos', photoId), { photoYear: newYear }); showToast('연도 저장 완료!'); } catch (e) { alert(e.message); } } };
  const handleDeletePhoto = async (photo) => { if (!confirm('정말로 삭제하시겠습니까?')) return; handleClosePopup(); setPhotos(prev => prev.filter(p => p.id !== photo.id)); showToast('삭제되었습니다.'); try { await deleteObject(ref(storage, photo.url)).catch((e) => console.log(e)); await deleteDoc(doc(db, 'photos', photo.id)); if (photo.uploaderId) { await updateDoc(doc(db, 'users', photo.uploaderId), { uploadCount: increment(-1) }); } } catch (e) { alert(e.message); } };

  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const onTouchStart = (e) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => { if (!touchStart || !touchEnd) return; if (isDetailViewRef.current) return; const distance = touchStart - touchEnd; if (distance > 50) { const i = TABS.indexOf(activeTab); if (i < TABS.length - 1) setActiveTab(TABS[i + 1]); } if (distance < -50) { const i = TABS.indexOf(activeTab); if (i > 0) setActiveTab(TABS[i - 1]); } };

  if (loading) { return <div className="min-h-screen w-full bg-gray-200 flex justify-center items-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>; }
  
  // 백지화 방지 (데이터 로딩 대기)
  if (user && !userData) { return <LoadingSpinner msg="회원 정보를 불러오는 중..." />; }

  const currentUserRealtime = user ? (members.find(m => m.id === user.uid) || userData) : null;

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
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-blue-900">신우 Photo</h1>
                <span className="text-[10px] text-gray-400 pt-1">{APP_VERSION}</span>
              </div>
              <button onClick={handleShareApp} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"><Share2 size={20} /></button>
            </header>

            <main
              className="flex-1 overflow-hidden p-0 relative bg-white"
              onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
            >
              {activeAlbumId && <div className="absolute inset-0 z-40 bg-white flex flex-col animate-fade-in"><AlbumDetailOverlay albumId={activeAlbumId} collections={collections} photos={photos} onClose={handleClosePopup} onPhotoClick={handleOpenDetail} /></div>}
              {selectedPhoto && <div className="absolute inset-0 z-50 bg-white flex flex-col animate-fade-in"><PhotoDetailView photo={selectedPhoto} onClose={handleClosePopup} onDelete={handleDeletePhoto} onUpdateDesc={handleUpdateDesc} onUpdateTags={setEditingPhoto} onUpdateYear={handleUpdateYear} openSaveModal={setSavingPhotoId} collections={collections} currentUser={user} userData={currentUserRealtime} showToast={showToast} activeAlbumId={activeAlbumId} toggleCollectionItem={toggleCollectionItem} onLike={handlePhotoLike} onShare={handleSharePhoto} /></div>}

              {activeTab === 'home' && <HomeTab photos={photos} collections={collections} openSaveModal={setSavingPhotoId} onPhotoClick={handleOpenDetail} />}
              
              {/* ★ [3차 방어선] MembersTab 내부에서도 userData 체크함 */}
              {activeTab === 'members' && <MembersTab members={members} photos={photos} onPhotoClick={handleOpenDetail} userData={currentUserRealtime} />}
              
              {/* ★ [4차 방어선] UploadTab 내부 체크 */}
              {activeTab === 'upload' && <UploadTab setActiveTab={setActiveTab} showToast={showToast} userData={currentUserRealtime} setLoading={setAppLoading} />}
              
              {activeTab === 'albums' && <AlbumsTab collections={collections} onOpenAlbum={handleOpenAlbum} createCollection={createCollection} deleteCollection={deleteCollection} renameCollection={renameCollection} />}
              
              {/* ★ [5차 방어선] MyPageTab 내부 체크 */}
              {activeTab === 'mypage' && <MyPageTab userData={currentUserRealtime} photos={photos} members={members} collections={collections} renameCollection={renameCollection} onOpenAlbum={(id) => handleOpenAlbum(id, 'mypage')} onPhotoClick={handleOpenDetail} />}
            </main>

            <nav className="bg-white border-t flex justify-around items-center h-16 absolute bottom-0 w-full z-30 px-1 shrink-0">
              <NavBtn icon={<Camera />} label="홈" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
              <NavBtn icon={<Trophy />} label="랭킹" active={activeTab === 'members'} onClick={() => setActiveTab('members')} />
              <NavBtn icon={<PlusSquare />} label="업로드" active={activeTab === 'upload'} onClick={() => setActiveTab('upload')} />
              <NavBtn icon={<BookHeart />} label="앨범" active={activeTab === 'albums'} onClick={() => setActiveTab('albums')} />
              <NavBtn icon={<User />} label="내정보" active={activeTab === 'mypage'} onClick={() => setActiveTab('mypage')} />
            </nav>
          </>
        )}

        {appLoading && (<div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center text-white"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mb-2"></div></div>)}
        {savingPhotoId && <SaveCollectionModal photos={photos} photoId={savingPhotoId} collections={collections} toggleCollectionItem={toggleCollectionItem} closeModal={() => setSavingPhotoId(null)} createCollection={createCollection}/>}
        {editingPhoto && <TagEditModal photo={editingPhoto} onSave={handleTagSave} closeModal={() => setEditingPhoto(null)} />}
        {toast && <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-full shadow-lg text-sm animate-bounce z-50 whitespace-nowrap">{toast}</div>}
      </div>
    </div>
  );
}

// --- 서브 컴포넌트들 ---
function AlbumDetailOverlay({ albumId, collections, photos, onClose, onPhotoClick }) {
  const activeAlbum = collections.find((c) => c.id === albumId);
  if (!activeAlbum) return null;
  const albumPhotos = photos.filter((p) => (activeAlbum.photoIds || []).includes(p.id));
  return ( <div className="flex flex-col h-full w-full bg-white"><div className="bg-white p-3 sticky top-0 z-20 shadow-sm flex items-center gap-2 shrink-0"><button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full"><ArrowLeft size={24} className="text-gray-700" /></button><span className="font-bold text-lg text-blue-900 truncate max-w-[200px]">{activeAlbum.name}</span></div><ScrollContent type="list">{albumPhotos.length === 0 ? (<div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm gap-3"><p>이 앨범은 비어있습니다.</p><button onClick={onClose} className="bg-blue-100 text-blue-600 px-4 py-2 rounded-full font-bold text-xs hover:bg-blue-200">📸 사진 담으러 가기</button></div>) : (<div className="grid grid-cols-3 gap-0.5">{albumPhotos.map((p) => (<div key={p.id} onClick={() => onPhotoClick(p)} className="aspect-square relative cursor-pointer"><img src={p.url} className="w-full h-full object-cover" /></div>))}</div>)}</ScrollContent></div> );
}
function PhotoDetailView({ photo, onClose, onDelete, onUpdateDesc, onUpdateTags, onUpdateYear, openSaveModal, collections, currentUser, userData, showToast, activeAlbumId, toggleCollectionItem, onLike, onShare }) {
  const isAdmin = userData?.role === 'admin';
  const isMyPost = currentUser && photo.uploaderId === currentUser.uid;
  const isLiked = (photo.likes || []).includes(currentUser?.uid);
  const displayTags = sortTagsSmart(photo.tags || []);
  return ( <div className="flex flex-col h-full w-full bg-white"><div className="p-3 border-b flex items-center justify-between sticky top-0 bg-white z-20 shadow-sm"><div className="flex items-center gap-3"><button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft size={24} className="text-gray-700" /></button><span className="font-bold text-lg truncate">사진 상세</span></div><div className="flex gap-2"><button onClick={() => onShare(photo)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"><Share2 size={20} /></button>{activeAlbumId && ( <button onClick={async () => { if (confirm("현재 앨범에서 이 사진을 뺄까요?")) { await toggleCollectionItem(activeAlbumId, photo.id); onClose(); } }} className="p-2 text-orange-500 hover:bg-orange-50 rounded-full" title="앨범에서 제외"><FolderX size={20} /></button> )}{(isMyPost || isAdmin) && (<button onClick={() => onDelete(photo)} className="p-2 text-red-500 hover:bg-red-50 rounded-full"><Trash2 size={20} /></button>)}</div></div><ScrollContent type="list" className="relative"><div className="w-full bg-black flex items-center justify-center relative group"><img src={photo.url} className="w-full h-auto max-h-[60vh] object-contain" /><button onClick={(e) => { e.stopPropagation(); window.open(photo.url, '_blank'); }} className="absolute bottom-3 right-3 bg-white/20 hover:bg-white/40 text-white backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition-all"><Maximize2 size={14} /> 원본/확대</button></div><div className="p-5 border-b"><div className="flex justify-between items-start mb-4"><div className="flex-1 mr-2"><div className="flex items-center gap-2 mb-1"><h2 className="text-xl font-bold text-gray-900">{photo.desc}</h2><button onClick={() => onUpdateDesc(photo.id, photo.desc)} className="text-gray-400 hover:text-blue-600 p-1"><Edit2 size={16} /></button></div><div className="text-sm text-gray-500 flex items-center flex-wrap gap-2"><span>By {photo.uploader}</span><span className="text-gray-300">|</span><div className="flex items-center gap-1 group cursor-pointer" onClick={() => onUpdateYear(photo.id, photo.photoYear)}><Calendar size={14} className="text-gray-400" />{photo.photoYear ? <span className="text-gray-700">{photo.photoYear}년</span> : <span className="text-orange-500 font-bold bg-orange-100 px-2 py-0.5 rounded-full text-xs animate-pulse">언제 찍었나요?</span>}<Edit2 size={10} className="opacity-50 group-hover:opacity-100 text-blue-500" /></div><span className="text-gray-300">|</span><span className="flex items-center gap-1"><Eye size={14}/> {photo.viewCount || 0}</span></div></div></div><div className="mb-6"><div className="flex flex-wrap gap-2 mb-2">{displayTags.map((tag, i) => (<span key={i} className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-sm font-medium border border-blue-100">{formatTag(tag)}</span>))}</div><button onClick={() => onUpdateTags(photo)} className="text-sm text-gray-500 flex items-center gap-1 hover:text-blue-600"><Plus size={14} /> 태그(기수) 추가</button></div><div className="flex gap-2"><button onClick={() => onLike(photo)} className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border ${isLiked ? 'bg-red-50 border-red-100 text-red-500' : 'bg-gray-50 border-gray-200 text-gray-600'}`}><Heart size={20} className={isLiked ? "fill-red-500" : ""} /> {(photo.likes || []).length}</button><button onClick={() => openSaveModal(photo.id)} className="flex-1 py-3 bg-blue-50 border border-blue-100 text-blue-700 rounded-xl font-bold text-sm flex items-center justify-center gap-2"><FolderPlus size={20} /> 앨범담기</button></div></div><CommentSection photoId={photo.id} currentUser={currentUser} userData={userData} showToast={showToast} /></ScrollContent></div> );
}

// ★ [수정됨] MembersTab에서 user.uid 대신 userData.id 사용 (백지화 방지)
function MembersTab({ members, photos, onPhotoClick, userData }) {
  if (!userData) return <LoadingSpinner msg="회원 정보를 불러오는 중..." />;
  const [viewMode, setViewMode] = useState('ranking'); const [rankType, setRankType] = useState('total'); const [search, setSearch] = useState(""); const [gisuFilter, setGisuFilter] = useState("ALL"); const [memberSort, setMemberSort] = useState("gisu"); const [showRules, setShowRules] = useState(false); const gisuList = [...new Set(members.map(m => m.gisu))].sort((a, b) => a - b); const isAdmin = userData.role === 'admin'; const stats = React.useMemo(() => calculateRealtimeStats(photos || []), [photos]);
  const getSortedRanking = () => { const membersWithScore = members.map(m => { const s = stats[m.id] || { upload: 0, rxHeart: 0, rxComment: 0 }; const totalScore = calculateUserScore(m, stats); const popularityScore = (s.rxHeart * POINTS.RX_HEART) + (s.rxComment * POINTS.RX_COMMENT); const talkerScore = ((m.commentCount||0) * POINTS.WR_COMMENT) + ((m.givenHeartCount||0) * POINTS.GV_HEART); return { ...m, ...s, totalScore, popularityScore, talkerScore }; }); if (rankType === 'total') return membersWithScore.sort((a, b) => b.totalScore - a.totalScore); if (rankType === 'upload') return membersWithScore.sort((a, b) => ((b.upload||0)*POINTS.UPLOAD) - ((a.upload||0)*POINTS.UPLOAD)); if (rankType === 'popular') return membersWithScore.sort((a, b) => b.popularityScore - a.popularityScore); if (rankType === 'talker') return membersWithScore.sort((a, b) => b.talkerScore - a.talkerScore); return [...photos].sort((a, b) => { const scoreA = (a.viewCount || 0) + (a.commentsCount || 0) * 10; const scoreB = (b.viewCount || 0) + (b.commentsCount || 0) * 10; return scoreB - scoreA; }); };
  const filteredMembers = members.filter(m => { const matchName = m.name.includes(search); const matchGisu = gisuFilter === "ALL" || m.gisu === gisuFilter; return matchName && matchGisu; });
  const handleToggleRole = async (targetMember) => { if (!isAdmin) return; const isTargetAdmin = targetMember.role === 'admin'; if (confirm(`'${targetMember.name}' 님의 권한을 변경하시겠습니까?`)) { try { await updateDoc(doc(db, 'users', targetMember.id), { role: isTargetAdmin ? 'user' : 'admin' }); } catch (e) { alert(e.message); } } };
  const sortedList = getSortedRanking().slice(0, 30); const getBtnStyle = (type) => `px-3 py-1 text-xs rounded-full border whitespace-nowrap ${rankType === type ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold' : 'bg-white border-gray-200 text-gray-500'}`;
  return ( <PageLayout><div className="p-3 sticky top-0 bg-white z-10 border-b"><div className="flex items-center justify-center mb-2 relative"><h2 className="font-bold text-lg text-yellow-600 flex items-center gap-1"><Crown size={20}/> 명예의 전당</h2><button onClick={() => setShowRules(!showRules)} className="absolute right-0 text-gray-400 hover:text-blue-500"><Info size={18}/></button></div>{showRules && (<div className="bg-blue-50 p-3 rounded-lg text-xs text-gray-700 mb-3 shadow-inner"><strong>[ 🏆 점수 기준 ]</strong><br/>📸 업로드: <b>+{POINTS.UPLOAD}</b> / 🏷️ 태그기여: <b>+{POINTS.TAG_EDIT}</b><br/>💬 받은댓글: <b>+{POINTS.RX_COMMENT}</b> / ✍️ 쓴댓글: <b>+{POINTS.WR_COMMENT}</b><br/>❤️ 받은하트: <b>+{POINTS.RX_HEART}</b> / 🤍 누른하트: <b>+{POINTS.GV_HEART}</b></div>)}<div className="flex bg-gray-100 p-1 rounded-xl mb-3"><button onClick={() => setViewMode('ranking')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${viewMode === 'ranking' ? 'bg-white text-blue-900 shadow' : 'text-gray-400'}`}><Trophy size={16} /> 랭킹</button><button onClick={() => setViewMode('list')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${viewMode === 'list' ? 'bg-white text-blue-900 shadow' : 'text-gray-400'}`}><List size={16} /> 전체 회원</button></div>{viewMode === 'ranking' && (<div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar"><button onClick={() => setRankType('total')} className={getBtnStyle('total')}>🏆 종합</button><button onClick={() => setRankType('upload')} className={getBtnStyle('upload')}>📸 사진왕</button><button onClick={() => setRankType('popular')} className={getBtnStyle('popular')}>❤️ 인기왕</button><button onClick={() => setRankType('talker')} className={getBtnStyle('talker')}>✍️ 소통왕</button><button onClick={() => setRankType('hot_photo')} className={getBtnStyle('hot_photo')}>🔥 인기사진</button></div>)}{viewMode === 'list' && (<div className="flex gap-2"><input className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100" placeholder="이름 검색" value={search} onChange={e => setSearch(e.target.value)}/><select className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none font-bold text-gray-600" value={gisuFilter} onChange={e => setGisuFilter(e.target.value)}><option value="ALL">전체 기수</option>{gisuList.map(g => <option key={g} value={g}>{g}기</option>)}</select></div>)}</div><ScrollContent type="list">{viewMode === 'ranking' ? ( rankType === 'hot_photo' ? (<div className="grid grid-cols-3 gap-0.5">{sortedList.map((p, idx) => (<div key={p.id} onClick={() => onPhotoClick(p)} className="aspect-square relative group cursor-pointer"><img src={p.url} className="w-full h-full object-cover" /><div className="absolute top-1 left-1 bg-yellow-400 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full shadow">{idx + 1}</div><div className="absolute bottom-0 w-full bg-black/50 text-white text-[10px] p-1 text-center">점수: {(p.viewCount||0) + (p.commentsCount||0)*10}</div></div>))}</div>) : (<ul className="divide-y">{sortedList.map((m, idx) => { let score = 0; if(rankType === 'total') score = m.totalScore; else if(rankType === 'upload') score = (m.upload||0) * POINTS.UPLOAD; else if(rankType === 'popular') score = m.popularityScore; else if(rankType === 'talker') score = m.talkerScore; let rank = idx + 1; if (idx > 0) { const prevM = sortedList[idx-1]; let prevScore = 0; if(rankType === 'total') prevScore = prevM.totalScore; else if(rankType === 'upload') prevScore = (prevM.upload||0) * POINTS.UPLOAD; else if(rankType === 'popular') prevScore = prevM.popularityScore; else if(rankType === 'talker') prevScore = prevM.talkerScore; if(score === prevScore) rank = idx; } return (<li key={m.id} className="p-4 flex items-center gap-4 hover:bg-gray-50"><div className={`w-8 h-8 flex items-center justify-center font-bold rounded-full ${rank === 1 ? 'bg-yellow-100 text-yellow-600' : rank <= 3 ? 'bg-gray-200' : 'text-gray-400'}`}>{rank}</div><div className="flex-1"><p className="font-bold text-gray-800">{m.name} <span className="text-xs font-normal text-gray-500">{m.gisu}기</span></p></div><div className="text-right"><span className="text-blue-600 font-bold text-lg">{score}</span><span className="text-xs text-gray-400 block">점</span></div>
  
  {/* ★ 백지화 해결 포인트: user.uid 대신 userData.id 사용 */}
  {isAdmin && userData.id !== m.id && (<button onClick={() => handleToggleRole(m)} className="p-2 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-full"><UserCog size={18}/></button>)}
  
  </li>) })}</ul>) ) : (<ul className="divide-y">{filteredMembers.sort((a,b) => { if (a.role === 'admin' && b.role !== 'admin') return -1; if (a.role !== 'admin' && b.role === 'admin') return 1; if (memberSort === 'gisu') return Number(a.gisu) - Number(b.gisu); return a.name.localeCompare(b.name); }).map(m => { const s = stats[m.id] || { upload: 0, rxHeart: 0, rxComment: 0 }; return (<li key={m.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold">👤</div><div><div className="flex items-center gap-2"><p className="font-bold text-gray-800">{m.name}</p>{m.role === 'admin' ? <span className="bg-red-100 text-red-600 text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5"><Shield size={10}/> 관리자</span> : <span className="bg-gray-100 text-gray-500 text-[10px] px-1.5 py-0.5 rounded font-medium">회원</span>}</div><p className="text-xs text-gray-400 mt-0.5">{m.gisu}기</p></div></div><div className="flex items-center gap-3"><div className="flex gap-2 text-xs text-gray-500 mr-2"><span className="flex items-center gap-1"><Camera size={14} className="text-blue-400"/> {(s.upload||0) * POINTS.UPLOAD}</span><span className="flex items-center gap-1"><MessageCircle size={14} className="text-green-400"/> {(m.commentCount||0)*POINTS.WR_COMMENT}</span></div>{isAdmin && userData.id !== m.id && (<button onClick={() => handleToggleRole(m)} className="p-2 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-full"><UserCog size={18}/></button>)}</div></li>)})}</ul>)}</ScrollContent></PageLayout> ); }
function HomeTab({ photos, collections, openSaveModal, onEditTags, onUpdateDesc, onUpdateYear, onDelete, currentUser, userData, showToast, isDetailViewRef, onPhotoClick }) { const [searchTerm, setSearchTerm] = useState(''); const [sortOption, setSortOption] = useState('upload_desc'); const filtered = photos.filter((p) => (p.desc || "").includes(searchTerm) || (p.tags && p.tags.some((t) => t.includes(searchTerm))) || (p.uploader || "").includes(searchTerm)); const sortedPhotos = [...filtered].sort((a, b) => { switch (sortOption) { case 'upload_desc': return (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0); case 'upload_asc': return (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0); case 'year_desc': return (Number(b.photoYear) || 0) - (Number(a.photoYear) || 0); case 'year_asc': { const ya = a.photoYear ? Number(a.photoYear) : 9999; const yb = b.photoYear ? Number(b.photoYear) : 9999; return ya - yb; } case 'random': return 0.5 - Math.random(); default: return 0; } }); return ( <PageLayout><div className="p-3 border-b sticky top-0 bg-white z-10 flex flex-col gap-2"><div className="relative w-full"><input className="w-full p-2 pl-9 border rounded-lg text-sm bg-gray-50 outline-none focus:ring-1 focus:ring-blue-200" placeholder="검색 (이름, 기수)" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /><div className="absolute left-3 top-2.5 text-gray-400">🔍</div></div><div className="flex justify-between items-center"><select className="text-xs font-bold bg-gray-50 border rounded-lg px-2 py-1.5 outline-none text-gray-600" value={sortOption} onChange={(e) => setSortOption(e.target.value)}><option value="upload_desc">최근 게시물</option><option value="upload_asc">과거 게시물</option><option value="year_desc">최근 촬영일</option><option value="year_asc">과거 촬영일</option><option value="random">랜덤 추억</option></select></div></div><ScrollContent type="list"><div className={`grid gap-0.5 grid-cols-3`}>{sortedPhotos.map((p) => (<div key={p.id} onClick={() => onPhotoClick(p)} className="aspect-square cursor-pointer relative overflow-hidden group"><img src={p.url} className="w-full h-full object-cover" />{p.commentsCount > 0 && <div className="absolute top-1 right-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1"><MessageCircle size={10} /> {p.commentsCount}</div>}{p.photoYear && <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[10px] px-1.5 rounded backdrop-blur-sm">{p.photoYear}</div>}</div>))}</div></ScrollContent></PageLayout> ); }
function AlbumsTab({ collections, onOpenAlbum, createCollection, deleteCollection, renameCollection }) { return ( <PageLayout><div className="p-4"><h2 className="font-bold text-lg mb-4 text-gray-700">📂 나의 앨범</h2><div className="grid grid-cols-2 gap-4">{collections.map((col) => (<div key={col.id} onClick={() => onOpenAlbum(col.id)} className="bg-gray-50 p-4 rounded-xl border flex flex-col items-center justify-center h-40 active:scale-95 transition-transform hover:bg-blue-50 relative group cursor-pointer"><FolderPlus size={32} className="text-yellow-600 mb-3" /><div onClick={(e) => e.stopPropagation()}><input className="font-bold text-gray-800 text-center bg-transparent border-none w-full focus:ring-0 p-0" value={col.name} onChange={(e) => renameCollection(col.id, e.target.value)} /></div><span className="text-xs text-gray-500">{col.photoIds.length}장</span>{!col.isDefault && (<button onClick={(e) => { e.stopPropagation(); deleteCollection(col.id, col.isDefault); }} className="absolute top-2 right-2 text-gray-300 hover:text-red-500 p-1"><Trash2 size={16} /></button>)}</div>))}<button onClick={() => createCollection()} className="border-2 border-dashed border-gray-300 p-4 rounded-xl flex flex-col items-center justify-center h-40 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"><Plus size={32} className="mb-2" /><span className="text-sm font-bold">새 앨범 만들기</span></button></div>{collections.length === 0 && <div className="text-center text-gray-400 py-20">아직 앨범이 없습니다.</div>}</div></PageLayout> ); }
function MyPageTab({ userData, photos, members, collections, renameCollection, onOpenAlbum, onPhotoClick }) {
  if (!userData) return <LoadingSpinner msg="내 정보를 불러오는 중..." />;
  const stats = calculateRealtimeStats(photos || []);
  const myStats = stats[userData.id] || { upload: 0, rxHeart: 0, rxComment: 0 };
  const myTotalScore = calculateUserScore(userData, stats);
  const allScores = members.map(m => calculateUserScore(m, stats)).sort((a, b) => b - a);
  const myRank = allScores.indexOf(myTotalScore) + 1;
  const totalUsers = members.length || 1; 
  const topPercent = Math.ceil((myRank / totalUsers) * 100);
  const myUploads = (photos || []).filter(p => p.uploaderId === userData.id).sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
  const recentPhotos = myUploads.slice(0, 5);
  return ( <PageLayout><ScrollContent type="form"><div className="flex flex-col items-center pt-10 pb-8 border-b border-gray-100 relative overflow-hidden"><div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-blue-50 to-white -z-10"></div><div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-blue-50 rounded-full mb-4 flex items-center justify-center text-4xl shadow-inner border-4 border-white">😎</div><div className="flex flex-col items-center"><div className="flex items-center gap-2"><h2 className="text-2xl font-bold text-gray-900">{userData.name}</h2><span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${userData.role === 'admin' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{userData.role === 'admin' ? '관리자' : `${userData.gisu}기`}</span></div><p className="text-sm text-gray-400 mt-1">{userData.email}</p></div><div className="mt-6 w-full max-w-xs bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-2xl p-4 shadow-sm flex flex-col items-center justify-center"><div className="flex items-center gap-2 text-yellow-700 font-bold text-sm mb-1"><Crown size={16}/> 현재 랭킹</div><div className="text-3xl font-extrabold text-yellow-800 mb-1">{myRank}위 <span className="text-sm font-normal text-yellow-600">/ {totalUsers}명</span></div><div className="text-xs text-yellow-600 font-medium bg-white/60 px-2 py-1 rounded-full">상위 {topPercent}% • 총점 {myTotalScore}점</div></div><button onClick={() => confirm("로그아웃 하시겠습니까?") && signOut(auth)} className="mt-6 text-xs text-gray-400 border border-gray-200 px-4 py-1.5 rounded-full flex items-center gap-1 hover:bg-gray-50 transition-colors"><LogOut size={12}/> 로그아웃</button></div><div className="px-4 mt-6"><h3 className="font-bold text-gray-800 mb-3 text-sm">나의 성과</h3><div className="grid grid-cols-3 gap-3"><div className="bg-blue-50 p-3 rounded-xl text-center border border-blue-100"><p className="text-xs text-blue-500 font-bold mb-1">📸 올린사진</p><p className="font-bold text-lg text-blue-900">{(myStats.upload||0)*POINTS.UPLOAD}점</p><p className="text-[10px] text-blue-400">({myStats.upload||0}장)</p></div><div className="bg-blue-50 p-3 rounded-xl text-center border border-blue-100"><p className="text-xs text-blue-500 font-bold mb-1">💬 받은댓글</p><p className="font-bold text-lg text-blue-900">{(myStats.rxComment||0)*POINTS.RX_COMMENT}점</p><p className="text-[10px] text-blue-400">({myStats.rxComment||0}개)</p></div><div className="bg-blue-50 p-3 rounded-xl text-center border border-blue-100"><p className="text-xs text-blue-500 font-bold mb-1">❤️ 받은하트</p><p className="font-bold text-lg text-blue-900">{(myStats.rxHeart||0)*POINTS.RX_HEART}점</p><p className="text-[10px] text-blue-400">({myStats.rxHeart||0}개)</p></div></div><h3 className="font-bold text-gray-800 mb-3 text-sm mt-5">참여 활동</h3><div className="grid grid-cols-3 gap-3"><div className="bg-gray-50 p-3 rounded-xl text-center border border-gray-200"><p className="text-xs text-gray-500 font-bold mb-1">🏷️ 태그기여</p><p className="font-bold text-lg text-gray-700">{(userData.tagEditCount||0)*POINTS.TAG_EDIT}점</p><p className="text-[10px] text-gray-400">({userData.tagEditCount||0}회)</p></div><div className="bg-gray-50 p-3 rounded-xl text-center border border-gray-200"><p className="text-xs text-gray-500 font-bold mb-1">✍️ 보낸댓글</p><p className="font-bold text-lg text-gray-700">{(userData.commentCount||0)*POINTS.WR_COMMENT}점</p><p className="text-[10px] text-gray-400">({userData.commentCount||0}개)</p></div><div className="bg-gray-50 p-3 rounded-xl text-center border border-gray-200"><p className="text-xs text-gray-500 font-bold mb-1">🤍 보낸하트</p><p className="font-bold text-lg text-gray-700">{(userData.givenHeartCount||0)*POINTS.GV_HEART}점</p><p className="text-[10px] text-gray-400">({userData.givenHeartCount||0}개)</p></div></div></div><div className="mt-8 px-4"><h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2"><Camera size={20} className="text-purple-500"/> 최근 올린 추억</h3>{recentPhotos.length === 0 ? ( <div className="bg-gray-50 rounded-xl p-6 text-center border border-dashed border-gray-300"><p className="text-gray-400 text-sm">아직 올린 사진이 없습니다.<br/>첫 사진을 올리고 100점을 받아보세요!</p></div> ) : ( <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">{recentPhotos.map(p => { const hasNewComment = p.lastCommentAt && (Date.now() - p.lastCommentAt.toDate().getTime() < 24 * 60 * 60 * 1000); return (<div key={p.id} onClick={() => onPhotoClick(p)} className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden relative cursor-pointer border border-gray-200 shadow-sm"><img src={p.url} className="w-full h-full object-cover" />{hasNewComment && <div className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse shadow-sm"></div>}</div>); })}</div> )}</div><div className="p-4 mt-4 mb-8"><button onClick={() => onOpenAlbum(null)} className="w-full py-4 bg-white border-2 border-gray-100 text-gray-600 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 hover:border-gray-200 transition-all shadow-sm"><BookHeart size={20} className="text-red-400"/> 나의 앨범 관리하러 가기 <ChevronRight size={16} className="text-gray-400"/></button></div></ScrollContent></PageLayout> ); }
function UploadTab({ setActiveTab, showToast, userData, setLoading }) { if (!userData) return <LoadingSpinner msg="회원 정보를 불러오는 중..." />; const [desc, setDesc] = useState(''); const [photoYear, setPhotoYear] = useState(''); const [tags, setTags] = useState([]); const [file, setFile] = useState(null); const [preview, setPreview] = useState(null); const handleUpload = async () => { if (!file || !desc) return alert('사진과 설명을 입력해주세요.'); try { setLoading(true); const fileRef = ref(storage, `photos/${Date.now()}_${file.name}`); await uploadBytes(fileRef, file); const url = await getDownloadURL(fileRef); const defaultTags = [`${userData.gisu}기`, userData.name]; const finalTags = [...new Set([...tags, ...defaultTags])]; await addDoc(collection(db, 'photos'), { url, desc, tags: finalTags, photoYear, uploader: userData.name, uploaderId: auth.currentUser.uid, timestamp: serverTimestamp(), commentsCount: 0, viewCount: 0 }); await updateDoc(doc(db, 'users', auth.currentUser.uid), { uploadCount: increment(1) }); setLoading(false); showToast('게시 완료! (+100점)'); setActiveTab('home'); } catch (e) { setLoading(false); alert(e.message); } }; return ( <PageLayout><ScrollContent type="form"><div className="border-2 border-dashed border-gray-200 bg-gray-50 rounded-2xl h-64 mb-6 flex flex-col items-center justify-center relative overflow-hidden hover:border-blue-300 transition-colors">{preview ? <img src={preview} className="w-full h-full object-contain" /> : <div className="text-center text-gray-400"><Camera size={48} className="mx-auto mb-2 opacity-30" /><p className="text-sm font-medium">사진을 선택해주세요</p></div>}<input type="file" accept="image/*" onChange={(e) => { if (e.target.files[0]) { setFile(e.target.files[0]); setPreview(URL.createObjectURL(e.target.files[0])); } }} className="absolute inset-0 opacity-0 cursor-pointer" /></div><div className="space-y-5"><div><label className="block font-bold text-gray-800 mb-2 text-sm">사진 설명</label><input className="w-full border border-gray-200 p-3.5 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="어떤 순간인가요?" /></div><div><label className="block font-bold text-gray-800 mb-2 text-sm">촬영 연도 <span className="text-gray-400 font-normal">(선택)</span></label><input type="number" pattern="[0-9]*" inputMode="numeric" className="w-full border border-gray-200 p-3.5 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all" value={photoYear} onChange={(e) => setPhotoYear(e.target.value)} placeholder="예: 1995" /></div><div><label className="block font-bold text-gray-800 mb-2 text-sm">등장 기수 <span className="text-gray-400 font-normal">(함께 채워가요!)</span></label><GisuInput tags={tags} setTags={setTags} /></div></div><div className="bg-blue-50 p-4 rounded-xl mt-6 mb-8 text-xs text-blue-800 flex gap-3 items-start"><span className="text-lg">💡</span><p>기수나 촬영 연도를 몰라도 괜찮아요. 나중에 다른 회원들이 댓글이나 태그 수정으로 알려줄 거예요!</p></div><button onClick={handleUpload} className="w-full bg-blue-900 text-white p-4 rounded-xl font-bold text-lg shadow-lg hover:bg-blue-800 active:scale-95 transition-all">게시하기</button></ScrollContent></PageLayout> ); }
function CommentSection({ photoId, currentUser, userData, showToast }) { const [comments, setComments] = useState([]); const [newComment, setNewComment] = useState(''); const [replyingTo, setReplyingTo] = useState(null); useEffect(() => { const q = query(collection(db, "comments"), where("photoId", "==", photoId)); const unsubscribe = onSnapshot(q, (snapshot) => { const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); list.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)); setComments(list); updateDoc(doc(db, "photos", photoId), { commentsCount: list.length }).catch(() => {}); }); return () => unsubscribe(); }, [photoId]); const handleSubmit = async (e) => { e.preventDefault(); if (!newComment.trim()) return; try { await addDoc(collection(db, "comments"), { photoId, text: newComment, writer: userData.name, writerId: currentUser.uid, writerGisu: userData.gisu, createdAt: serverTimestamp(), likes: [], parentId: replyingTo ? replyingTo.id : null, }); await updateDoc(doc(db, "photos", photoId), { lastCommentAt: serverTimestamp() }); await updateDoc(doc(db, "users", currentUser.uid), { commentCount: increment(1) }); setNewComment(''); setReplyingTo(null); showToast("댓글 등록! (+10점)"); } catch (e) { alert('오류: ' + e.message); } }; const handleDelete = async (commentId) => { if (!confirm("삭제하시겠습니까?")) return; await deleteDoc(doc(db, "comments", commentId)); }; const handleLike = async (comment) => { const isLiked = comment.likes?.includes(currentUser.uid); const commentRef = doc(db, "comments", comment.id); if (isLiked) { await updateDoc(commentRef, { likes: arrayRemove(currentUser.uid) }); await updateDoc(doc(db, 'users', currentUser.uid), { givenHeartCount: increment(-1) }); } else { await updateDoc(commentRef, { likes: arrayUnion(currentUser.uid) }); await updateDoc(doc(db, 'users', currentUser.uid), { givenHeartCount: increment(1) }); } }; const rootComments = comments.filter(c => !c.parentId); const getReplies = (parentId) => comments.filter(c => c.parentId === parentId); const CommentItem = ({ comment, isReply = false }) => ( <div className={`flex gap-3 mb-3 ${isReply ? 'pl-10' : ''}`}><div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0 border">{comment.writer[0]}</div><div className="flex-1"><div className="bg-gray-50 p-3 rounded-xl rounded-tl-none text-sm"><div className="flex justify-between items-center mb-1"><span className="font-bold text-gray-800">{comment.writer} <span className="text-xs text-gray-400 font-normal">{comment.writerGisu}기</span></span><span className="text-[10px] text-gray-400">{formatDate(comment.createdAt)}</span></div><p className="text-gray-700 whitespace-pre-wrap">{comment.text}</p></div><div className="flex gap-3 mt-1 pl-2 text-xs text-gray-500"><button onClick={() => handleLike(comment)} className={`flex items-center gap-1 ${comment.likes?.includes(currentUser.uid) ? 'text-red-500 font-bold' : ''}`}><ThumbsUp size={12} /> {comment.likes?.length > 0 && comment.likes.length}</button>{!isReply && <button onClick={() => setReplyingTo(comment)}>답글</button>}{(comment.writerId === currentUser.uid || userData?.role === 'admin') && (<button onClick={() => handleDelete(comment.id)} className="text-red-400">삭제</button>)}</div></div></div> ); return ( <div className="border-t bg-white"><div className="p-4 pb-24"><h3 className="font-bold text-gray-800 mb-4 text-sm flex items-center gap-2"><MessageCircle size={16}/> 댓글 {comments.length}</h3><div className="space-y-2 mb-4">{rootComments.map(root => (<div key={root.id}><CommentItem comment={root} />{getReplies(root.id).map(reply => (<div key={reply.id} className="relative"><div className="absolute left-4 top-0 bottom-6 w-4 border-l-2 border-b-2 border-gray-100 rounded-bl-xl"></div><CommentItem comment={reply} isReply={true} /></div>))}</div>))}</div></div><div className="absolute bottom-0 w-full bg-white border-t p-3 z-10 flex flex-col">{replyingTo && (<div className="flex justify-between items-center bg-blue-50 px-3 py-2 rounded-lg mb-2 text-xs"><span className="text-blue-600 font-bold">@{replyingTo.writer}님에게 답글</span><button onClick={() => setReplyingTo(null)}><X size={14}/></button></div>)}<form onSubmit={handleSubmit} className="flex gap-2"><input className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100" placeholder="댓글을 입력하세요..." value={newComment} onChange={e => setNewComment(e.target.value)} /><button type="submit" disabled={!newComment.trim()} className="bg-blue-600 text-white p-2 rounded-full disabled:bg-gray-300"><Send size={18} className="ml-0.5"/></button></form></div></div> ); }
function GisuInput({ tags, setTags }) { const [input, setInput] = useState(""); const addGisu = () => { if (!input) return; const newTag = /^\d+$/.test(input) ? `${input}기` : input; if (!tags.includes(newTag)) setTags([...tags, newTag]); setInput(""); }; return ( <div className="space-y-2"><div className="flex gap-2"><input type="number" pattern="[0-9]*" inputMode="numeric" className="flex-1 border p-3 rounded-lg bg-gray-50 outline-none focus:bg-white" placeholder="기수 (숫자만)" value={input} onChange={e => setInput(e.target.value.replace(/[^0-9]/g, ""))} onKeyPress={e => e.key === 'Enter' && addGisu()}/><button onClick={addGisu} className="bg-blue-600 text-white px-4 rounded-lg font-bold shrink-0">추가</button></div><div className="flex flex-wrap gap-2 min-h-[40px] p-3 bg-gray-50 rounded-lg border border-dashed border-gray-200">{tags.length === 0 && <span className="text-gray-400 text-xs py-1">입력된 기수가 없습니다.</span>}{tags.map((tag, i) => (<span key={i} className="bg-white text-blue-600 border border-blue-200 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 shadow-sm">{formatTag(tag)}<button onClick={() => setTags(tags.filter(t => t !== tag))} className="text-gray-400 hover:text-red-500"><X size={14}/></button></span>))}</div></div> ); }
function TagEditModal({ photo, onSave, closeModal }) { const [tags, setTags] = useState(photo.tags || []); return ( <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"><div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"><div className="p-4 border-b flex justify-between items-center bg-white"><h3 className="font-bold text-lg">기수 수정</h3><button onClick={closeModal}><X size={24} className="text-gray-500"/></button></div><div className="p-5 space-y-4"><div className="flex items-center gap-3 mb-2"><img src={photo.url} className="w-16 h-16 object-cover rounded-lg border" /><div><p className="font-bold text-sm truncate w-40">{photo.desc}</p></div></div><GisuInput tags={tags} setTags={setTags} /><button onClick={() => onSave(photo, tags)} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-lg mt-2">저장하기</button></div></div></div> ); }
function OnboardingScreen({ onStart }) { return ( <div className="h-full w-full bg-white flex flex-col items-center justify-center p-8 relative"><div className="flex-1 flex flex-col justify-center items-center text-center space-y-8"><div><img src="/logo.jpg" className="w-24 h-auto mx-auto mb-4 animate-bounce" /><h1 className="text-2xl font-bold text-blue-900 mb-2">환영합니다!</h1><p className="text-gray-500">신우 회원들을 위한<br/>추억 저장소입니다.</p></div><button onClick={onStart} className="w-full bg-blue-900 text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 hover:bg-blue-800 mt-6">시작하기 <ArrowLeft className="rotate-180"/></button></div></div> ); }
function AuthScreen() { const [isLoginMode, setIsLoginMode] = useState(true); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState(""); const [gisu, setGisu] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false); const handleAuth = async () => { setError(""); setLoading(true); try { if (isLoginMode) { await signInWithEmailAndPassword(auth, email, password); } else { if(!name || !gisu) throw new Error("이름과 기수를 입력해주세요."); const userCredential = await createUserWithEmailAndPassword(auth, email, password); await setDoc(doc(db, "users", userCredential.user.uid), { name, gisu, email, role: 'user', joinedAt: serverTimestamp() }); } } catch (err) { setError("로그인 실패: " + err.message); } setLoading(false); }; const bgImageUrl = "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop"; return ( <div className="h-full w-full flex flex-col items-center justify-center bg-gray-900 bg-cover bg-center relative before:absolute before:inset-0 before:bg-black/50" style={{ backgroundImage: `url(${bgImageUrl})` }}><div className="bg-black/70 p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center backdrop-blur-md border border-white/10 z-10 mx-4"><div className="mb-6 flex justify-center"><img src="/logo.jpg" alt="신우 로고" className="w-40 h-auto object-contain" /></div><h1 className="text-3xl font-bold text-white mb-2 font-serif">신우 Photo</h1><div className="space-y-3"><input className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 outline-none" type="email" placeholder="이메일" value={email} onChange={e=>setEmail(e.target.value)}/><input type="password" className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 outline-none" placeholder="비밀번호" value={password} onChange={e=>setPassword(e.target.value)}/>{!isLoginMode && (<><input className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 outline-none" placeholder="이름" value={name} onChange={e=>setName(e.target.value)}/><input className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 outline-none" placeholder="기수 (숫자만)" value={gisu} onChange={e=>setGisu(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" /></>)}</div>{error && <p className="text-red-400 mt-3">{error}</p>}<button onClick={handleAuth} disabled={loading} className="w-full mt-6 bg-yellow-600 hover:bg-yellow-500 text-white p-3 rounded-xl font-bold shadow-lg">{isLoginMode ? "로그인" : "가입하기"}</button><div className="mt-4 flex justify-center gap-2 text-sm"><span className="text-gray-400">{isLoginMode ? "계정이 없으신가요?" : "계정이 있으신가요?"}</span><button onClick={() => {setIsLoginMode(!isLoginMode); setError("");}} className="text-yellow-500 font-bold hover:underline">{isLoginMode ? "회원가입" : "로그인"}</button></div></div></div> ); }
function SaveCollectionModal({ photoId, collections, toggleCollectionItem, closeModal, createCollection }) { const [newColName, setNewColName] = useState(""); const [isCreating, setIsCreating] = useState(false); return ( <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"><div className="bg-white w-full max-w-sm rounded-xl overflow-hidden shadow-2xl"><div className="p-4 border-b flex justify-between items-center"><h3 className="font-bold">어디에 담을까요?</h3><button onClick={closeModal}><X size={20}/></button></div><div className="max-h-60 overflow-y-auto p-2">{collections.map(col => (<button key={col.id} onClick={async () => { await toggleCollectionItem(col.id, photoId); closeModal(); }} className={`w-full text-left p-3 rounded-lg mb-1 flex justify-between items-center ${col.photoIds.includes(photoId) ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}`}><span className="font-medium">{col.name}</span>{col.photoIds.includes(photoId) && <Check size={18}/>}</button>))}</div><div className="p-3 border-t bg-gray-50">{isCreating ? (<div className="flex gap-2"><input autoFocus className="flex-1 border p-2 rounded text-sm" placeholder="새 앨범 이름" value={newColName} onChange={e => setNewColName(e.target.value)} /><button onClick={() => { createCollection(newColName); setIsCreating(false); setNewColName(""); }} className="bg-blue-600 text-white px-3 rounded text-sm font-bold">확인</button></div>) : (<button onClick={() => setIsCreating(true)} className="w-full py-2 text-blue-600 text-sm font-bold flex items-center justify-center gap-1"><Plus size={16}/> 새 폴더 만들기</button>)}</div></div></div> ); }
function NavBtn({ icon, label, active, onClick }) { return ( <button onClick={onClick} className={`flex flex-col items-center justify-center flex-1 min-w-0 ${active ? 'text-blue-600' : 'text-gray-400'}`}>{React.cloneElement(icon, { size: 22 })}<span className="text-[10px] mt-1 font-bold whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">{label}</span></button> ); }