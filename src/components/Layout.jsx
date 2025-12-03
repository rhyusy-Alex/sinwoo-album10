import React from 'react';

// 전체 페이지 레이아웃
export const PageLayout = ({ children, className = "" }) => (
  <div className={`flex-1 w-full h-full bg-white flex flex-col overflow-hidden relative ${className}`}>
    {children}
  </div>
);

// 스크롤 가능한 콘텐츠 영역 (리스트형/폼형 구분)
export const ScrollContent = ({ children, type = 'list', className = "" }) => {
  const paddingClass = type === 'form' ? 'px-5 pt-5 pb-24' : 'pb-20';
  return (
    <div className={`flex-1 w-full h-full overflow-y-auto ${paddingClass} ${className}`}>
      {children}
    </div>
  );
};

// 로딩 스피너
export const LoadingSpinner = ({ msg = "로딩중..." }) => (
  <div className="flex h-full w-full items-center justify-center flex-col gap-4">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
    <p className="text-gray-400 text-sm font-medium">{msg}</p>
  </div>
);

// 하단 네비게이션 버튼
export const NavBtn = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center flex-1 min-w-0 ${active ? 'text-blue-600' : 'text-gray-400'}`}>
    {React.cloneElement(icon, { size: 22 })}
    <span className="text-[10px] mt-1 font-bold whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">{label}</span>
  </button>
);