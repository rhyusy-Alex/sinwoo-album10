import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function OnboardingScreen({ onStart }) {
  return (
    <div className="h-full w-full bg-white flex flex-col items-center justify-center p-8 relative">
      <div className="flex-1 flex flex-col justify-center items-center text-center space-y-8">
        <div>
          <img src="/logo.jpg" className="w-24 h-auto mx-auto mb-4 animate-bounce" alt="logo" />
          <h1 className="text-2xl font-bold text-blue-900 mb-2">환영합니다!</h1>
          <p className="text-gray-500">신우 회원들을 위한<br/>추억 저장소입니다.</p>
        </div>
        <button onClick={onStart} className="w-full bg-blue-900 text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 hover:bg-blue-800 mt-6">
          시작하기 <ArrowLeft className="rotate-180"/>
        </button>
      </div>
    </div>
  );
}