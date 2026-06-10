'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  CornerDownRight,
  MessageCircle,
  Clock,
  Trash2,
  Edit2,
  X,
  Loader2,
  CornerRightDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { FeedComment, Profile } from '@/types';

interface FeedCommentSectionProps {
  feedId: string;
  currentUserProfile: Profile | null;
}

export function FeedCommentSection({ feedId, currentUserProfile }: FeedCommentSectionProps) {
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Composer state for new main comment
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingMain, setSubmittingMain] = useState(false);

  // Thread reply states
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Edit comment states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function loadComments() {
      try {
        const res = await fetch(`/api/feeds/${feedId}/comentarios`);
        const data = await res.json();
        if (res.ok) {
          setComments(data.comments || []);
        }
      } catch (err) {
        console.error('Error loading comments:', err);
      } finally {
        setLoading(false);
      }
    }
    loadComments();
  }, [feedId]);

  const handlePostMainComment = async () => {
    if (!newCommentText.trim()) return;

    setSubmittingMain(true);
    try {
      const res = await fetch(`/api/feeds/${feedId}/comentarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conteudo: newCommentText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setNewCommentText('');
      setComments([...comments, data.comment]);
      toast.success('Comentário publicado');
    } catch (err: any) {
      toast.error(err.message || 'Falha ao publicar comentário');
    } finally {
      setSubmittingMain(false);
    }
  };

  const handlePostReply = async (paiId: string) => {
    if (!replyText.trim()) return;

    setSubmittingReply(true);
    try {
      const res = await fetch(`/api/feeds/${feedId}/comentarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conteudo: replyText, comentario_pai_id: paiId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setReplyText('');
      setReplyToId(null);
      setComments([...comments, data.comment]);
      toast.success('Resposta publicada');
    } catch (err: any) {
      toast.error(err.message || 'Falha ao publicar resposta');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleSaveEdit = async (comId: string) => {
    if (!editText.trim()) return;

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/comentarios/${comId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conteudo: editText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setComments(comments.map((c) => (c.id === comId ? data.comment : c)));
      setEditingId(null);
      setEditText('');
      toast.success('Comentário atualizado');
    } catch (err: any) {
      toast.error(err.message || 'Falha ao atualizar comentário');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (comId: string) => {
    if (!confirm('Deseja excluir este comentário?')) return;

    try {
      const res = await fetch(`/api/comentarios/${comId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();

      setComments(comments.filter((c) => c.id !== comId));
      toast.success('Comentário removido');
    } catch (err) {
      toast.error('Falha ao excluir comentário');
    }
  };

  // Group comments hierarchically (up to 3 levels)
  // Level 1: comentario_pai_id = null
  // Level 2: comentario_pai_id = Level 1 comment
  // Level 3: comentario_pai_id = Level 2 comment
  const rootComments = comments.filter((c) => !c.comentario_pai_id);
  
  const getReplies = (parentId: string) => {
    return comments.filter((c) => c.comentario_pai_id === parentId);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-4">
        <Loader2 className="size-4 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4 text-slate-300">
      {/* Root Comments List */}
      {rootComments.length === 0 ? (
        <p className="text-xs text-slate-500 italic pl-1">Seja o primeiro a comentar!</p>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {rootComments.map((c) => {
            const level2Replies = getReplies(c.id);
            return (
              <div key={c.id} className="space-y-2 border-b border-slate-800/20 pb-3 last:border-b-0">
                {/* Level 1 Comment card */}
                <CommentCard
                  comment={c}
                  currentUserProfile={currentUserProfile}
                  onReply={() => {
                    setReplyToId(c.id);
                    setReplyText('');
                    setTimeout(() => replyInputRef.current?.focus(), 50);
                  }}
                  onEdit={() => {
                    setEditingId(c.id);
                    setEditText(c.conteudo);
                    setTimeout(() => editInputRef.current?.focus(), 50);
                  }}
                  onDelete={() => handleDelete(c.id)}
                  isEditing={editingId === c.id}
                  editText={editText}
                  setEditText={setEditText}
                  onSaveEdit={() => handleSaveEdit(c.id)}
                  onCancelEdit={() => setEditingId(null)}
                  savingEdit={savingEdit}
                />

                {/* Level 2 Replies */}
                {level2Replies.length > 0 && (
                  <div className="pl-6 space-y-2 border-l border-slate-800/80 mt-2 ml-3">
                    {level2Replies.map((c2) => {
                      const level3Replies = getReplies(c2.id);
                      return (
                        <div key={c2.id} className="space-y-2">
                          <CommentCard
                            comment={c2}
                            currentUserProfile={currentUserProfile}
                            onReply={() => {
                              setReplyToId(c2.id);
                              setReplyText('');
                              setTimeout(() => replyInputRef.current?.focus(), 50);
                            }}
                            onEdit={() => {
                              setEditingId(c2.id);
                              setEditText(c2.conteudo);
                              setTimeout(() => editInputRef.current?.focus(), 50);
                            }}
                            onDelete={() => handleDelete(c2.id)}
                            isEditing={editingId === c2.id}
                            editText={editText}
                            setEditText={setEditText}
                            onSaveEdit={() => handleSaveEdit(c2.id)}
                            onCancelEdit={() => setEditingId(null)}
                            savingEdit={savingEdit}
                            isReply
                          />

                          {/* Level 3 Replies */}
                          {level3Replies.length > 0 && (
                            <div className="pl-6 space-y-2 border-l border-slate-800/60 mt-1 ml-3">
                              {level3Replies.map((c3) => (
                                <CommentCard
                                  key={c3.id}
                                  comment={c3}
                                  currentUserProfile={currentUserProfile}
                                  onReply={null} // Max 3 levels depth
                                  onEdit={() => {
                                    setEditingId(c3.id);
                                    setEditText(c3.conteudo);
                                    setTimeout(() => editInputRef.current?.focus(), 50);
                                  }}
                                  onDelete={() => handleDelete(c3.id)}
                                  isEditing={editingId === c3.id}
                                  editText={editText}
                                  setEditText={setEditText}
                                  onSaveEdit={() => handleSaveEdit(c3.id)}
                                  onCancelEdit={() => setEditingId(null)}
                                  savingEdit={savingEdit}
                                  isReply
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Inline thread composer */}
                {replyToId === c.id && (
                  <div className="flex gap-2 items-start pl-6 mt-2 ml-3">
                    <CornerDownRight className="size-4 text-slate-600 shrink-0 mt-2" />
                    <div className="flex-1 bg-slate-950/40 border border-slate-800 rounded-lg p-2 space-y-2">
                      <Textarea
                        ref={replyInputRef}
                        placeholder="Responder a este comentário..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        rows={1}
                        className="bg-transparent border-0 text-xs min-h-[36px] text-white focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-600"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setReplyToId(null)} className="h-6 text-[10px] text-slate-500 hover:text-white">
                          Cancelar
                        </Button>
                        <Button size="sm" onClick={() => handlePostReply(c.id)} disabled={submittingReply} className="h-6 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-2">
                          {submittingReply ? 'Publicando...' : 'Responder'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Main Comment Composer */}
      <div className="flex gap-2 items-start bg-slate-950/20 border border-slate-850 p-2.5 rounded-xl">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 font-extrabold text-xs">
          {currentUserProfile ? currentUserProfile.full_name.charAt(0).toUpperCase() : 'C'}
        </div>
        <div className="flex-1 flex gap-2">
          <Input
            placeholder="Adicionar um comentário..."
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            className="h-8 text-xs bg-slate-900 border-slate-800 text-white placeholder:text-slate-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handlePostMainComment();
            }}
          />
          <Button
            size="sm"
            onClick={handlePostMainComment}
            disabled={submittingMain}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 font-semibold shrink-0"
          >
            {submittingMain ? <Loader2 className="size-3 animate-spin" /> : 'Comentar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Single Comment Card helper component
interface CommentCardProps {
  comment: FeedComment;
  currentUserProfile: Profile | null;
  onReply: (() => void) | null;
  onEdit: () => void;
  onDelete: () => void;
  isEditing: boolean;
  editText: string;
  setEditText: (t: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  savingEdit: boolean;
  isReply?: boolean;
}

function CommentCard({
  comment,
  currentUserProfile,
  onReply,
  onEdit,
  onDelete,
  isEditing,
  editText,
  setEditText,
  onSaveEdit,
  onCancelEdit,
  savingEdit,
  isReply = false,
}: CommentCardProps) {
  const isAuthor = currentUserProfile && comment.autor_id === currentUserProfile.id;
  const formattedTime = new Date(comment.criado_em).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`flex gap-2 items-start ${isReply ? 'pl-2' : ''}`}>
      {isReply && <CornerDownRight className="size-3 text-slate-700 shrink-0 mt-2" />}
      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 font-extrabold text-[10px] shrink-0 border border-emerald-500/10">
        {comment.autor ? comment.autor.full_name.charAt(0).toUpperCase() : 'U'}
      </div>
      <div className="flex-1 min-w-0 bg-slate-950/20 border border-slate-900/60 p-2.5 rounded-xl space-y-1">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-white">
              {comment.autor ? comment.autor.full_name : 'Usuário'}
            </span>
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <Clock className="size-2.5" />
              {formattedTime}
            </span>
            {comment.editado && <span className="text-[9px] text-slate-500">(editado)</span>}
          </div>

          <div className="flex items-center gap-1.5">
            {onReply && (
              <button
                onClick={onReply}
                className="text-[10px] font-bold text-slate-500 hover:text-emerald-400 transition-all hover:underline"
              >
                Responder
              </button>
            )}
            {isAuthor && !isEditing && (
              <>
                <button onClick={onEdit} className="text-slate-500 hover:text-white" title="Editar">
                  <Edit2 className="size-2.5" />
                </button>
                <button onClick={onDelete} className="text-slate-500 hover:text-red-400" title="Excluir">
                  <Trash2 className="size-2.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-2 mt-1">
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={1}
              className="bg-slate-900 border-slate-800 text-xs text-white"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={onCancelEdit} className="text-[10px] text-slate-500 hover:text-white">
                Cancelar
              </button>
              <button
                onClick={onSaveEdit}
                disabled={savingEdit}
                className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300"
              >
                {savingEdit ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-300 leading-relaxed break-words">{comment.conteudo}</p>
        )}
      </div>
    </div>
  );
}
