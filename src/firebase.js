import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth"; // ★ 로그인 도구 추가됨

// ▼▼▼ [중요] 아까 복사해둔 키 값을 여기에 다시 넣어주세요! ▼▼▼
const firebaseConfig = {
  apiKey: "AIzaSyBTyZhMV-4c4G5vaotLU_WzWBuP_-BSEyQ",
  authDomain: "sinwoophoto.firebaseapp.com",
  projectId: "sinwoophoto",
  storageBucket: "sinwoophoto.firebasestorage.app",
  messagingSenderId: "901128723784",
  appId: "1:901128723784:web:55066e79685905f2f7677d"
};
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app); // ★ 로그인 기능 내보내기