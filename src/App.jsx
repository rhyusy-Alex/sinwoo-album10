import React, { useState, useEffect, useRef } from 'react';
import { Camera, PlusSquare, User, Share2, BookHeart, Trophy } from 'lucide-react';
import { db, auth } from './firebase';
import { collection, onSnapshot, query, where, doc, getDoc, serverTimestamp, addDoc, updateDoc, increment, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
// ★ [추가] 애니메이션 라이브러리
import { motion, AnimatePresence } from 'framer-motion';

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
  
  // --- 탭 & 애니메이션 상태 관리 ---
  const [activeTab, setActiveTab] = useState('home');
  const [direction, setDirection] = useState(0); // 1: 오른쪽(다음), -1: 왼쪽(이전)
  const TABS = ['home', 'members', 'upload', 'albums', 'mypage'];
  
  const isDetailViewRef = useRef(false);

  // photos 배열 미사용 (각 탭에서 직접 fetch)
  const photos = []; 
  
  const [members, setMembers] = useState([]);
  const [collections, setCollections] = useState([]);

  const [activeAlbumId, setActiveAlbumId] = useState(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState(null);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [livePhoto, setLivePhoto] = useState(null);
  
  const [savingPhotoId, setSavingPhotoId] = useState(null);
  const [toast, setToast] = useState(null);
  const [appLoading, setAppLoading] = useState(false);

  // ★ [추가] 탭 변경 핸들러 (방향 계산 포함)
  const handleTabChange = (newTab) => {
    if (newTab === activeTab) return;
    const newIndex = TABS.indexOf(newTab);
    const oldIndex = TABS.indexOf(activeTab);
    // 새 탭이 뒤에 있으면 1(오른쪽), 앞에 있으면 -1(왼쪽)
    setDirection(newIndex > oldIndex ? 1 : -1);
    setActiveTab(newTab);
  };

  // ★ [추가] 슬라이드 애니메이션 설정값
  const pageVariants = {
    initial: (direction) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0, // 살짝 투명하게 시작
    }),
    animate: {
      x: 0,
      opacity: 1,
      transition: { duration: 0.3, ease: "easeOut" } // 부드러운 감속
    },
    exit: (direction) => ({
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0, // 나갈 때 투명해짐
      transition: { duration: 0.3, ease: "easeIn" }
    })
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // --- 실시간 데이터 구독 ---
  useEffect(() => {
    if (!selectedPhotoId) {
      setLivePhoto(null);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, 'photos', selectedPhotoId), (docSnap) => {
      if (docSnap.exists()) {
        setLivePhoto({ id: docSnap.id, ...docSnap.data() });
      } else {
        setLivePhoto(null);
        setSelectedPhotoId(null);
        showToast("삭제된 사진입니다.");
      }
    });
    return () => unsubscribe();
  }, [selectedPhotoId]);

  const selectedMember = selectedMemberId ? members.find(m => m.id === selectedMemberId) : null;

  // --- 초기화 ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const photoId = params.get('photoId');
    if (photoId) {
      sessionStorage.setItem('pendingPhotoId', photoId);
      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  useEffect(() => {
    if (user) {
      const pendingPhotoId = sessionStorage.getItem('pendingPhotoId');
      if (pendingPhotoId) {
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
    isDetailViewRef.current = !!selectedPhotoId || !!selectedMemberId || (activeTab === 'albums' && !!activeAlbumId);
  }, [selectedPhotoId, selectedMemberId, activeAlbumId, activeTab]);

  const handleOpenAlbum = (albumId) => {
    window.history.pushState({ modal: 'album' }, ''); 
    setActiveAlbumId(albumId);
    handleTabChange('albums'); // 앨범 탭으로 이동 시 애니메이션 적용
  };

  const handleOpenDetail = async (photo) => {
    window.history.pushState({ modal: 'photo' }, '');
    setSelectedPhotoId(photo.id); 
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
  
  // ★ [수정] 스와이프 핸들러: setActiveTab 대신 handleTabChange 사용
  const onTouchEnd = () => { 
    if (!touchStart || !touchEnd) return; 
    if (isDetailViewRef.current) return; 
    const distance = touchStart - touchEnd; 
    if (distance > 50) { 
      const i = TABS.indexOf(activeTab); 
      if (i < TABS.length - 1) handleTabChange(TABS[i + 1]); 
    } 
    if (distance < -50) { 
      const i = TABS.indexOf(activeTab); 
      if (i > 0) handleTabChange(TABS[i - 1]); 
    } 
  };

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

            {/* ★ [수정] 메인 영역: 스와이프 및 애니메이션 적용 */}
            <main
              className="flex-1 overflow-hidden relative bg-white"
              onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
            >
              {/* 전역 오버레이들 (애니메이션과 무관하게 위에 뜸) */}
              {activeAlbumId && <div className="absolute inset-0 z-40 bg-white flex flex-col animate-fade-in"><AlbumDetailOverlay albumId={activeAlbumId} collections={collections} onClose={handleClosePopup} onPhotoClick={handleOpenDetail} /></div>}
              {selectedMember && <div className="absolute inset-0 z-40 bg-white flex flex-col animate-fade-in"><MemberProfileView member={selectedMember} photos={[]} onClose={handleClosePopup} onPhotoClick={handleOpenDetail} /></div>}
              {livePhoto && <div className="absolute inset-0 z-50 bg-white flex flex-col animate-fade-in"><PhotoDetailView photo={livePhoto} onClose={handleClosePopup} openSaveModal={setSavingPhotoId} activeAlbumId={activeAlbumId} toggleCollectionItem={toggleCollectionItem} showToast={showToast} /></div>}

              {/* ★ [핵심] AnimatePresence로 탭 전환 애니메이션 구현 */}
              <AnimatePresence initial={false} custom={direction} mode="popLayout">
                <motion.div
                  key={activeTab} // 키가 바뀌면 애니메이션 실행
                  custom={direction}
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="w-full h-full absolute inset-0" // 겹쳐서 애니메이션 되도록 절대위치
                >
                  {activeTab === 'home' && <HomeTab openSaveModal={setSavingPhotoId} onPhotoClick={handleOpenDetail} />}
                  {activeTab === 'members' && <MembersTab members={members} photos={[]} onPhotoClick={handleOpenDetail} onMemberClick={handleOpenMemberProfile} userData={currentUserRealtime} />}
                  {activeTab === 'upload' && <UploadTab setActiveTab={handleTabChange} showToast={showToast} userData={currentUserRealtime} setLoading={setAppLoading} />}
                  {activeTab === 'albums' && <AlbumsTab collections={collections} onOpenAlbum={handleOpenAlbum} createCollection={createCollection} deleteCollection={deleteCollection} renameCollection={renameCollection} />}
                  {activeTab === 'mypage' && <MyPageTab userData={currentUserRealtime} photos={[]} members={members} collections={collections} renameCollection={renameCollection} onOpenAlbum={(id) => { setActiveAlbumId(id); handleTabChange('albums'); }} onPhotoClick={handleOpenDetail} />}
                </motion.div>
              </AnimatePresence>
            </main>

            {/* 하단 탭바: setActiveTab 대신 handleTabChange 사용 */}
            <nav className="bg-white border-t flex justify-around items-center h-16 absolute bottom-0 w-full z-30 px-1 shrink-0">
              <NavBtn icon={<Camera />} label="홈" active={activeTab === 'home'} onClick={() => handleTabChange('home')} />
              <NavBtn icon={<Trophy />} label="랭킹" active={activeTab === 'members'} onClick={() => handleTabChange('members')} />
              <NavBtn icon={<PlusSquare />} label="업로드" active={activeTab === 'upload'} onClick={() => handleTabChange('upload')} />
              <NavBtn icon={<BookHeart />} label="앨범" active={activeTab === 'albums'} onClick={() => handleTabChange('albums')} />
              <NavBtn icon={<User />} label="내정보" active={activeTab === 'mypage'} onClick={() => handleTabChange('mypage')} />
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

