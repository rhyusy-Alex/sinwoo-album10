import React, { useState, useMemo } from 'react';
import { PageLayout, ScrollContent, LoadingSpinner } from '../components/Layout';
import { Crown, Info, Trophy, List, Shield, Camera, MessageCircle, UserCog } from 'lucide-react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { calculateRealtimeStats, calculateUserScore, POINTS } from '../utils';

// ★ [변경] onMemberClick prop 추가
export default function MembersTab({ members, photos, onPhotoClick, onMemberClick, userData }) {
  if (!userData) return <LoadingSpinner msg="회원 정보를 불러오는 중..." />;

  const [viewMode, setViewMode] = useState('ranking');
  const [rankType, setRankType] = useState('total');
  const [search, setSearch] = useState("");
  const [gisuFilter, setGisuFilter] = useState("ALL");
  const [memberSort, setMemberSort] = useState("gisu");
  const [showRules, setShowRules] = useState(false);

  const gisuList = [...new Set(members.map(m => m.gisu))].sort((a, b) => a - b);
  const isAdmin = userData.role === 'admin';
  
  const stats = useMemo(() => calculateRealtimeStats(photos || []), [photos]);

  const getSortedRanking = () => {
    const membersWithScore = members.map(m => {
      const s = stats[m.id] || { upload: 0, rxHeart: 0, rxComment: 0 };
      const totalScore = calculateUserScore(m, stats);
      const popularityScore = (s.rxHeart * POINTS.RX_HEART) + (s.rxComment * POINTS.RX_COMMENT);
      const talkerScore = ((m.commentCount||0) * POINTS.WR_COMMENT) + ((m.givenHeartCount||0) * POINTS.GV_HEART);
      return { ...m, ...s, totalScore, popularityScore, talkerScore };
    });

    const sortFn = (scoreProp) => (a, b) => {
      const scoreDiff = b[scoreProp] - a[scoreProp];
      if (scoreDiff !== 0) return scoreDiff;
      return a.name.localeCompare(b.name);
    };

    if (rankType === 'total') return membersWithScore.sort(sortFn('totalScore'));
    if (rankType === 'upload') return membersWithScore.sort((a, b) => ((b.upload||0) - (a.upload||0)) || a.name.localeCompare(b.name));
    if (rankType === 'popular') return membersWithScore.sort(sortFn('popularityScore'));
    if (rankType === 'talker') return membersWithScore.sort(sortFn('talkerScore'));
    
    return [...photos].sort((a, b) => {
      const scoreA = (a.viewCount || 0) + (a.commentsCount || 0) * 10;
      const scoreB = (b.viewCount || 0) + (b.commentsCount || 0) * 10;
      return scoreB - scoreA;
    });
  };

  const filteredMembers = members.filter(m => {
    const matchName = m.name.includes(search);
    const matchGisu = gisuFilter === "ALL" || m.gisu === gisuFilter;
    return matchName && matchGisu;
  });

  const handleToggleRole = async (targetMember) => {
    if (!isAdmin) return;
    const isTargetAdmin = targetMember.role === 'admin';
    const message = isTargetAdmin 
      ? `'${targetMember.name}' 님의 [관리자 권한]을 해제하시겠습니까?` 
      : `'${targetMember.name}' 님을 [관리자]로 임명하시겠습니까?`;

    if (confirm(message)) {
      try {
        await updateDoc(doc(db, 'users', targetMember.id), { role: isTargetAdmin ? 'user' : 'admin' });
      } catch (e) { alert(e.message); }
    }
  };

  const sortedList = getSortedRanking().slice(0, 30);
  const getBtnStyle = (type) => `px-3 py-1 text-xs rounded-full border whitespace-nowrap ${rankType === type ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold' : 'bg-white border-gray-200 text-gray-500'}`;

  const ScoreDisplay = ({ score }) => (
    <div className="text-right w-[3.5rem]"> 
      <span className="text-blue-600 font-bold text-lg">{score}</span>
      <span className="text-xs text-gray-400 block">점</span>
    </div>
  );

  return (
    <PageLayout>
      <div className="p-3 sticky top-0 bg-white z-10 border-b">
        <div className="flex items-center justify-center mb-2 relative">
          <h2 className="font-bold text-lg text-yellow-600 flex items-center gap-1"><Crown size={20}/> 명예의 전당</h2>
          <button onClick={() => setShowRules(!showRules)} className="absolute right-0 text-gray-400 hover:text-blue-500"><Info size={18}/></button>
        </div>
        {showRules && (<div className="bg-blue-50 p-3 rounded-lg text-xs text-gray-700 mb-3 shadow-inner"><strong>[ 🏆 점수 기준 ]</strong><br/>📸 업로드: <b>+{POINTS.UPLOAD}</b> / 🏷️ 태그기여: <b>+{POINTS.TAG_EDIT}</b><br/>💬 받은댓글: <b>+{POINTS.RX_COMMENT}</b> / ✍️ 쓴댓글: <b>+{POINTS.WR_COMMENT}</b><br/>❤️ 받은하트: <b>+{POINTS.RX_HEART}</b> / 🤍 누른하트: <b>+{POINTS.GV_HEART}</b></div>)}
        <div className="flex bg-gray-100 p-1 rounded-xl mb-3">
          <button onClick={() => setViewMode('ranking')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${viewMode === 'ranking' ? 'bg-white text-blue-900 shadow' : 'text-gray-400'}`}><Trophy size={16} /> 랭킹</button>
          <button onClick={() => setViewMode('list')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${viewMode === 'list' ? 'bg-white text-blue-900 shadow' : 'text-gray-400'}`}><List size={16} /> 전체 회원</button>
        </div>
        {viewMode === 'ranking' && (<div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar"><button onClick={() => setRankType('total')} className={getBtnStyle('total')}>🏆 종합</button><button onClick={() => setRankType('upload')} className={getBtnStyle('upload')}>📸 사진왕</button><button onClick={() => setRankType('popular')} className={getBtnStyle('popular')}>❤️ 인기왕</button><button onClick={() => setRankType('talker')} className={getBtnStyle('talker')}>✍️ 소통왕</button><button onClick={() => setRankType('hot_photo')} className={getBtnStyle('hot_photo')}>🔥 인기사진</button></div>)}
        {viewMode === 'list' && (<div className="flex gap-2"><input className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100" placeholder="이름 검색" value={search} onChange={e => setSearch(e.target.value)}/><select className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none font-bold text-gray-600" value={gisuFilter} onChange={e => setGisuFilter(e.target.value)}><option value="ALL">전체 기수</option>{gisuList.map(g => <option key={g} value={g}>{g}기</option>)}</select></div>)}
      </div>
      <ScrollContent type="list">
        {viewMode === 'ranking' ? (
          rankType === 'hot_photo' ? (
            <div className="grid grid-cols-3 gap-0.5">
              {sortedList.map((p, idx) => (
                <div key={p.id} onClick={() => onPhotoClick(p)} className="aspect-square relative group cursor-pointer">
                  <img src={p.url} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute top-1 left-1 bg-yellow-400 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full shadow">{idx + 1}</div>
                  <div className="absolute bottom-0 w-full bg-black/50 text-white text-[10px] p-1 text-center">점수: {(p.viewCount||0) + (p.commentsCount||0)*10}</div>
                </div>
              ))}
            </div>
          ) : (
            <ul className="divide-y">
              {sortedList.map((m, idx) => {
                // ... 점수 계산 및 랭킹 로직 생략 (기존과 동일) ...
                let score = 0;
                if(rankType === 'total') score = m.totalScore;
                else if(rankType === 'upload') score = (m.upload||0) * POINTS.UPLOAD;
                else if(rankType === 'popular') score = m.popularityScore;
                else if(rankType === 'talker') score = m.talkerScore;
                
                let scoreKey = 'totalScore';
                if(rankType === 'upload') scoreKey = 'upload';
                else if(rankType === 'popular') scoreKey = 'popularityScore';
                else if(rankType === 'talker') scoreKey = 'talkerScore';

                const myVal = (rankType === 'upload') ? (m.upload || 0) : m[scoreKey];
                const firstIndex = sortedList.findIndex(item => {
                    if(rankType === 'upload') return (item.upload || 0) === myVal;
                    return item[scoreKey] === myVal;
                });
                const rank = firstIndex + 1;

                return (
                  <li 
                    key={m.id} 
                    // ★ [변경] 행 클릭 시 상세 프로필 열기
                    onClick={() => onMemberClick(m)}
                    className="p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer active:bg-blue-50 transition-colors"
                  >
                    <div className={`w-8 h-8 flex items-center justify-center font-bold rounded-full ${rank === 1 ? 'bg-yellow-100 text-yellow-600' : rank <= 3 ? 'bg-gray-200' : 'text-gray-400'}`}>{rank}</div>
                    
                    <div className="flex-1 flex items-center flex-wrap gap-1">
                      <p className="font-bold text-gray-800">{m.name} <span className="text-xs font-normal text-gray-500">{m.gisu}기</span></p>
                      {m.role === 'admin' && <span className="text-[10px] font-bold text-white bg-red-400 px-1.5 py-0.5 rounded-md shadow-sm">관리자</span>}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <ScoreDisplay score={score} />
                      
                      {isAdmin && (
                        userData.id !== m.id ? (
                          // ★ [변경] 버튼 클릭 시 부모(행) 클릭 이벤트 막기 (stopPropagation)
                          <button onClick={(e) => { e.stopPropagation(); handleToggleRole(m); }} className="p-2 rounded-full text-gray-300 hover:text-blue-600 hover:bg-blue-50">
                            <UserCog size={18}/>
                          </button>
                        ) : (
                          <div className="w-[34px] h-[34px]"></div>
                        )
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )
        ) : (
          <ul className="divide-y">
            {filteredMembers.sort((a,b) => { /* 정렬 로직 동일 */ return a.name.localeCompare(b.name); }).map(m => {
              const s = stats[m.id] || { upload: 0, rxHeart: 0, rxComment: 0 };
              return (
                <li 
                    key={m.id} 
                    // ★ [변경] 전체 회원 리스트에서도 클릭 시 상세 프로필
                    onClick={() => onMemberClick(m)}
                    className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer active:bg-blue-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold">👤</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-800">{m.name}</p>
                        {m.role === 'admin' ? <span className="bg-red-100 text-red-600 text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5"><Shield size={10}/> 관리자</span> : <span className="bg-gray-100 text-gray-500 text-[10px] px-1.5 py-0.5 rounded font-medium">회원</span>}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{m.gisu}기</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-2 text-xs text-gray-500 mr-2">
                      <span className="flex items-center gap-1"><Camera size={14} className="text-blue-400"/> {(s.upload||0) * POINTS.UPLOAD}</span>
                      <span className="flex items-center gap-1"><MessageCircle size={14} className="text-green-400"/> {(m.commentCount||0)*POINTS.WR_COMMENT}</span>
                    </div>
                    {isAdmin && (
                        userData.id !== m.id ? (
                          <button onClick={(e) => { e.stopPropagation(); handleToggleRole(m); }} className="p-2 rounded-full text-gray-300 hover:text-blue-600 hover:bg-blue-50">
                            <UserCog size={18}/>
                          </button>
                        ) : (
                          <div className="w-[34px] h-[34px]"></div>
                        )
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </ScrollContent>
    </PageLayout>
  );
}