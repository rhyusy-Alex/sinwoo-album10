import React, { useState, useEffect, useRef } from 'react';
import { Camera, PlusSquare, User, Share2, BookHeart, Trophy } from 'lucide-react';
import { db, auth } from './firebase';
import { collection, onSnapshot, query, where, doc, getDoc, serverTimestamp, addDoc, updateDoc, increment, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';

import { APP_VERSION } from './utils';
import { LoadingSpinner, NavBtn } from './components/Layout';
import AuthScreen from './components/AuthScreen';
import OnboardingScreen from './components/OnboardingScreen';
import PhotoDetailView from './components/PhotoDetailView';
import AlbumDetailOverlay from './components/AlbumDetailOverlay';
import SaveCollectionModal from './components/SaveCollectionModal';
import MemberProfileView from './components/MemberProfileView';

import HomeTab from './tabs/HomeTab';
import MembersTab from './tabs/MembersTab';
import UploadTab from './tabs/UploadTab';
import AlbumsTab from './tabs/AlbumsTab';
import MyPageTab from './tabs/MyPageTab';

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const isDetailViewRef = useRef(false);

  // photos 배열은 이제 전역에서 사용하지 않음 (빈 배열)
  // *주의: 이로 인해 Ranking 점수가 일시적으로 0점이 됩니다. (다음 단계에서 해결)
  const photos = []; 
  
  const [members, setMembers] = useState([]);
  const [collections, setCollections] = useState([]);

  const [activeAlbumId, setActiveAlbumId] = useState(null);
  
  // 선택된 항목 ID 관리
  const [selectedPhotoId, setSelectedPhotoId] = useState(null);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  
  // ★ 단일 항목 실시간 데이터 (상세 화면용)
  const [livePhoto, setLivePhoto] = useState(null);
  
  const [savingPhotoId, setSavingPhotoId] = useState(null);
  const [toast, setToast] = useState(null);
  const [appLoading, setAppLoading] = useState(false);

  const TABS = ['home', 'members', 'upload', 'albums', 'mypage'];

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // --- 1. 사진 상세 실시간 구독 (Single Doc Listener) ---
  // 사용자가 사진을 클릭하면, 그 사진 하나의 데이터만 실시간으로 가져옴
  useEffect(() => {
    if (!selectedPhotoId) {
      setLivePhoto(null);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, 'photos', selectedPhotoId), (docSnap) => {
      if (docSnap.exists()) {
        setLivePhoto({ id: docSnap.id, ...docSnap.data() });
      } else {
        // 사진이 삭제된 경우
        setLivePhoto(null);
        setSelectedPhotoId(null);
        showToast("삭제된 사진입니다.");
      }
    });
    return () => unsubscribe();
  }, [selectedPhotoId]);

  // --- 2. 멤버 데이터 매핑 ---
  const selectedMember = selectedMemberId ? members.find(m => m.id === selectedMemberId) : null;

  // --- 초기화 및 인증 ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const photoId = params.get('photoId');
    if (photoId) {
      sessionStorage.setItem('pendingPhotoId', photoId);
      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  // 딥링크 처리 (유저 로그인 후 실행)
  useEffect(() => {
    if (user) {
      const pendingPhotoId = sessionStorage.getItem('pendingPhotoId');
      if (pendingPhotoId) {
        // ID만 있으면 열 수 있음
        setSelectedPhotoId(pendingPhotoId); 
        window.history.pushState({ modal: 'photo' }, '');
        showToast("공유받은 사진을 열었습니다! 🎁");
        sessionStorage.removeItem('pendingPhotoId');
      }
    }
  }, [user]);

  useEffect(() => {
    const handlePopState = (event) => {
      if (selectedPhotoId) setSelectedPhotoId(null);
      else if (selectedMemberId) setSelectedMemberId(null);
      else if (activeAlbumId) setActiveAlbumId(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedPhotoId, selectedMemberId, activeAlbumId]);

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
          await signOut(auth);
          setUser(null);
          setUserData(null);
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 회원 목록 구독
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      setMembers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  // 앨범 목록 구독
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
    isDetailViewRef.current = !!selectedPhotoId || !!selectedMemberId || (activeTab === 'albums' && !!activeAlbumId);
  }, [selectedPhotoId, selectedMemberId, activeAlbumId, activeTab]);

  // --- 핸들러 함수들 ---
  const handleOpenAlbum = (albumId) => {
    window.history.pushState({ modal: 'album' }, ''); 
    setActiveAlbumId(albumId);
    setActiveTab('albums');
  };

  const handleOpenDetail = async (photo) => {
    window.history.pushState({ modal: 'photo' }, '');
    setSelectedPhotoId(photo.id); // ID 저장 -> useEffect가 데이터 fetch
    try { await updateDoc(doc(db, "photos", photo.id), { viewCount: increment(1) }); } catch (e) {}
  };

  const handleOpenMemberProfile = (member) => {
    window.history.pushState({ modal: 'profile' }, '');
    setSelectedMemberId(member.id);
  }

  const handleClosePopup = () => {
    window.history.back(); 
  };

  const handleShareApp = async () => {
    const shareData = { title: '신우 Photo', text: '동문들을 위한 추억 저장소입니다. 함께해요!', url: window.location.origin };
    try { if (navigator.share) await navigator.share(shareData); else { await navigator.clipboard.writeText(shareData.url); showToast("주소가 복사되었습니다!"); } } catch (e) { console.log('Share closed'); }
  };

  const createCollection = async (name) => {
    if (!user) return;
    let albumName = name || "새 앨범";
    if (!name) {
        let isValid = false;
        while (!isValid) {
            albumName = prompt("새 앨범 이름을 입력해주세요:", albumName);
            if (albumName === null) return;
            if (!albumName.trim()) { alert("이름을 입력해주세요."); continue; }
            if (collections.some(c => c.name === albumName)) { alert("이미 같은 이름의 앨범이 있습니다."); continue; }
            isValid = true;
        }
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

  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const onTouchStart = (e) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => { if (!touchStart || !touchEnd) return; if (isDetailViewRef.current) return; const distance = touchStart - touchEnd; if (distance > 50) { const i = TABS.indexOf(activeTab); if (i < TABS.length - 1) setActiveTab(TABS[i + 1]); } if (distance < -50) { const i = TABS.indexOf(activeTab); if (i > 0) setActiveTab(TABS[i - 1]); } };

  if (loading) return <div className="min-h-screen w-full bg-gray-200 flex justify-center items-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>;
  if (user && !userData) return <LoadingSpinner msg="회원 정보를 불러오는 중..." />;

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
              {activeAlbumId && <div className="absolute inset-0 z-40 bg-white flex flex-col animate-fade-in"><AlbumDetailOverlay albumId={activeAlbumId} collections={collections} onClose={handleClosePopup} onPhotoClick={handleOpenDetail} /></div>}
              
              {/* 멤버 프로필: photos는 빈 배열 (다음 단계에서 수정 필요) */}
              {selectedMember && <div className="absolute inset-0 z-40 bg-white flex flex-col animate-fade-in"><MemberProfileView member={selectedMember} photos={[]} onClose={handleClosePopup} onPhotoClick={handleOpenDetail} /></div>}

              {/* ★ [핵심] livePhoto 사용: 선택된 사진 상세 정보가 잘 뜸 */}
              {livePhoto && <div className="absolute inset-0 z-50 bg-white flex flex-col animate-fade-in"><PhotoDetailView photo={livePhoto} onClose={handleClosePopup} openSaveModal={setSavingPhotoId} activeAlbumId={activeAlbumId} toggleCollectionItem={toggleCollectionItem} showToast={showToast} /></div>}

              {activeTab === 'home' && <HomeTab openSaveModal={setSavingPhotoId} onPhotoClick={handleOpenDetail} />}
              
              {/* photos=[] 이므로 랭킹은 0점으로 나옴 (정상) */}
              {activeTab === 'members' && <MembersTab members={members} photos={[]} onPhotoClick={handleOpenDetail} onMemberClick={handleOpenMemberProfile} userData={currentUserRealtime} />}
              
              {activeTab === 'upload' && <UploadTab setActiveTab={setActiveTab} showToast={showToast} userData={currentUserRealtime} setLoading={setAppLoading} />}
              
              {activeTab === 'albums' && <AlbumsTab collections={collections} onOpenAlbum={handleOpenAlbum} createCollection={createCollection} deleteCollection={deleteCollection} renameCollection={renameCollection} />}
              
              {activeTab === 'mypage' && <MyPageTab userData={currentUserRealtime} photos={[]} members={members} collections={collections} renameCollection={renameCollection} onOpenAlbum={(id) => handleOpenAlbum(id, 'mypage')} onPhotoClick={handleOpenDetail} />}
            </main>

            <nav className="bg-white border-t flex justify-around items-center h-16 absolute bottom-0 w-full z-30 px-1 shrink-0">
              <NavBtn icon={<Camera />} label="홈" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
              <NavBtn icon={<Trophy />} label="랭킹" active={activeTab === 'members'} onClick={() => setActiveTab('members')} />
              <NavBtn icon={<PlusSquare />} label="업로드" active={activeTab === 'upload'} onClick={() => setActiveTab('upload')} />
              <NavBtn icon={<BookHeart />} label="앨범" active={activeTab === 'albums'} onClick={() => setActiveTab('albums')} />
              <NavBtn icon={<User />} label="내정보" active={activeTab === 'mypage'} onClick={() => setActiveTab('mypage')} />
            </nav>
            
            {appLoading && (<div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center text-white"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mb-2"></div></div>)}
            {savingPhotoId && <SaveCollectionModal photoId={savingPhotoId} collections={collections} toggleCollectionItem={toggleCollectionItem} closeModal={() => setSavingPhotoId(null)} createCollection={createCollection}/>}
            {toast && <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-full shadow-lg text-sm animate-bounce z-50 whitespace-nowrap">{toast}</div>}
          </>
        )}
      </div>
    </div>
  );
}