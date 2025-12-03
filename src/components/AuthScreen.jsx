import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function AuthScreen() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [gisu, setGisu] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    setError("");
    setLoading(true);
    try {
      if (isLoginMode) {
        // 로그인 시도
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // 회원가입 시도
        if(!name || !gisu) throw new Error("이름과 기수를 입력해주세요.");
        
        // 1. 인증 계정 생성
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // 2. DB에 유저 정보 저장
        await setDoc(doc(db, "users", userCredential.user.uid), {
          name, 
          gisu, 
          email, 
          role: 'user', 
          joinedAt: serverTimestamp()
        });
      }
    } catch (err) {
      setError("로그인 실패: " + err.message);
    }
    setLoading(false);
  };

  const bgImageUrl = "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop";

  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-gray-900 bg-cover bg-center relative before:absolute before:inset-0 before:bg-black/50" style={{ backgroundImage: `url(${bgImageUrl})` }}>
      <div className="bg-black/70 p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center backdrop-blur-md border border-white/10 z-10 mx-4">
        <div className="mb-6 flex justify-center">
          <img src="/logo.jpg" alt="신우 로고" className="w-40 h-auto object-contain" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2 font-serif">신우 Photo</h1>
        <div className="space-y-3">
          <input className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 outline-none" type="email" placeholder="이메일" value={email} onChange={e=>setEmail(e.target.value)}/>
          <input type="password" className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 outline-none" placeholder="비밀번호" value={password} onChange={e=>setPassword(e.target.value)}/>
          {!isLoginMode && (
            <>
              <input className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 outline-none" placeholder="이름" value={name} onChange={e=>setName(e.target.value)}/>
              <input className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 outline-none" placeholder="기수 (숫자만)" value={gisu} onChange={e=>setGisu(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" />
            </>
          )}
        </div>
        {error && <p className="text-red-400 mt-3">{error}</p>}
        <button onClick={handleAuth} disabled={loading} className="w-full mt-6 bg-yellow-600 hover:bg-yellow-500 text-white p-3 rounded-xl font-bold shadow-lg">
          {isLoginMode ? "로그인" : "가입하기"}
        </button>
        <div className="mt-4 flex justify-center gap-2 text-sm">
          <span className="text-gray-400">{isLoginMode ? "계정이 없으신가요?" : "계정이 있으신가요?"}</span>
          <button onClick={() => {setIsLoginMode(!isLoginMode); setError("");}} className="text-yellow-500 font-bold hover:underline">
            {isLoginMode ? "회원가입" : "로그인"}
          </button>
        </div>
      </div>
    </div>
  );
}