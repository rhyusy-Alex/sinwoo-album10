import React, { useState, useEffect } from 'react';
import { MessageCircle, Send, ThumbsUp, X } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
import { formatDate } from '../utils';

export default function CommentSection({ photoId, currentUser, userData, showToast }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "comments"), where("photoId", "==", photoId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // 시간순 정렬
      list.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setComments(list);
      // 사진의 댓글 수 동기화
      updateDoc(doc(db, "photos", photoId), { commentsCount: list.length }).catch(() => {});
    });
    return () => unsubscribe();
  }, [photoId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      await addDoc(collection(db, "comments"), {
        photoId,
        text: newComment,
        writer: userData.name,
        writerId: currentUser.uid,
        writerGisu: userData.gisu,
        createdAt: serverTimestamp(),
        likes: [],
        parentId: replyingTo ? replyingTo.id : null,
      });
      // 사진에 최근 댓글 시간 업데이트 (New 표시용)
      await updateDoc(doc(db, "photos", photoId), { lastCommentAt: serverTimestamp() });
      // 작성자 댓글 카운트 증가
      await updateDoc(doc(db, "users", currentUser.uid), { commentCount: increment(1) });
      
      setNewComment('');
      setReplyingTo(null);
      if(showToast) showToast("댓글 등록! (+10점)");
    } catch (e) {
      alert('오류: ' + e.message);
    }
  };

  const handleDelete = async (commentId) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await deleteDoc(doc(db, "comments", commentId));
  };

  const handleLike = async (comment) => {
    const isLiked = comment.likes?.includes(currentUser.uid);
    const commentRef = doc(db, "comments", comment.id);
    if (isLiked) {
      await updateDoc(commentRef, { likes: arrayRemove(currentUser.uid) });
      await updateDoc(doc(db, 'users', currentUser.uid), { givenHeartCount: increment(-1) });
    } else {
      await updateDoc(commentRef, { likes: arrayUnion(currentUser.uid) });
      await updateDoc(doc(db, 'users', currentUser.uid), { givenHeartCount: increment(1) });
    }
  };

  const rootComments = comments.filter(c => !c.parentId);
  const getReplies = (parentId) => comments.filter(c => c.parentId === parentId);

  const CommentItem = ({ comment, isReply = false }) => (
    <div className={`flex gap-3 mb-3 ${isReply ? 'pl-10' : ''}`}>
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0 border">
        {comment.writer ? comment.writer[0] : '?'}
      </div>
      <div className="flex-1">
        <div className="bg-gray-50 p-3 rounded-xl rounded-tl-none text-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="font-bold text-gray-800">{comment.writer} <span className="text-xs text-gray-400 font-normal">{comment.writerGisu}기</span></span>
            <span className="text-[10px] text-gray-400">{formatDate(comment.createdAt)}</span>
          </div>
          <p className="text-gray-700 whitespace-pre-wrap">{comment.text}</p>
        </div>
        <div className="flex gap-3 mt-1 pl-2 text-xs text-gray-500">
          <button onClick={() => handleLike(comment)} className={`flex items-center gap-1 ${comment.likes?.includes(currentUser.uid) ? 'text-red-500 font-bold' : ''}`}>
            <ThumbsUp size={12} /> {comment.likes?.length > 0 && comment.likes.length}
          </button>
          {!isReply && <button onClick={() => setReplyingTo(comment)}>답글</button>}
          {(comment.writerId === currentUser.uid || userData?.role === 'admin') && (
            <button onClick={() => handleDelete(comment.id)} className="text-red-400">삭제</button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="border-t bg-white">
      <div className="p-4 pb-24">
        <h3 className="font-bold text-gray-800 mb-4 text-sm flex items-center gap-2"><MessageCircle size={16}/> 댓글 {comments.length}</h3>
        <div className="space-y-2 mb-4">
          {rootComments.map(root => (
            <div key={root.id}>
              <CommentItem comment={root} />
              {getReplies(root.id).map(reply => (
                <div key={reply.id} className="relative">
                  <div className="absolute left-4 top-0 bottom-6 w-4 border-l-2 border-b-2 border-gray-100 rounded-bl-xl"></div>
                  <CommentItem comment={reply} isReply={true} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-0 w-full bg-white border-t p-3 z-10 flex flex-col">
        {replyingTo && (
          <div className="flex justify-between items-center bg-blue-50 px-3 py-2 rounded-lg mb-2 text-xs">
            <span className="text-blue-600 font-bold">@{replyingTo.writer}님에게 답글</span>
            <button onClick={() => setReplyingTo(null)}><X size={14}/></button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100" placeholder="댓글을 입력하세요..." value={newComment} onChange={e => setNewComment(e.target.value)} />
          <button type="submit" disabled={!newComment.trim()} className="bg-blue-600 text-white p-2 rounded-full disabled:bg-gray-300"><Send size={18} className="ml-0.5"/></button>
        </form>
      </div>
    </div>
  );
}