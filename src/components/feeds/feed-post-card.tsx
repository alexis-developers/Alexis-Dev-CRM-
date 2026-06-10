'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  MessageSquare,
  Pin,
  Trash2,
  Edit2,
  Paperclip,
  Clock,
  User,
  Shield,
  Smile,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FeedCommentSection } from './feed-comment-section';
import type { Feed, FeedReacaoTipo, Profile } from '@/types';

// Reaction emoji mapping
const REACTION_EMOJIS: Record<FeedReacaoTipo, string> = {
  curtir: '👍',
  amei: '❤️',
  parabens: '🎉',
  importante: '⚠️',
  risada: '😂',
};

const REACTION_LABELS: Record<FeedReacaoTipo, string> = {
  curtir: 'Curtir',
  amei: 'Amei',
  parabens: 'Parabéns',
  importante: 'Importante',
  risada: 'Risada',
};

interface FeedPostCardProps {
  feed: Feed;
  currentUserProfile: Profile | null;
  onDelete: (id: string) => void;
  onUpdate: (updatedFeed: any) => void;
}

export function FeedPostCard({
  feed,
  currentUserProfile,
  onDelete,
  onUpdate,
}: FeedPostCardProps) {
  const supabase = createClient();
  const [showComments, setShowComments] = useState(false);
  const [reactions, setReactions] = useState<{ tipo_reacao: FeedReacaoTipo; count: number; active: boolean }[]>([]);
  const [loadingReactions, setLoadingReactions] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(feed.titulo);
  const [editContent, setEditContent] = useState(feed.conteudo);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    async function loadReactions() {
      try {
        const { data, error } = await supabase
          .from('feed_reacoes')
          .select('*')
          .eq('feed_id', feed.id);

        if (error) throw error;

        // Group counts
        const grouped: Record<FeedReacaoTipo, { count: number; active: boolean }> = {
          curtir: { count: 0, active: false },
          amei: { count: 0, active: false },
          parabens: { count: 0, active: false },
          importante: { count: 0, active: false },
          risada: { count: 0, active: false },
        };

        data?.forEach((r) => {
          const type = r.tipo_reacao as FeedReacaoTipo;
          if (grouped[type]) {
            grouped[type].count += 1;
            if (currentUserProfile && r.usuario_id === currentUserProfile.id) {
              grouped[type].active = true;
            }
          }
        });

        const list = Object.entries(grouped).map(([tipo, val]) => ({
          tipo_reacao: tipo as FeedReacaoTipo,
          count: val.count,
          active: val.active,
        }));

        setReactions(list);
      } catch (err) {
        console.error('Error fetching reactions:', err);
      } finally {
        setLoadingReactions(false);
      }
    }
    loadReactions();
  }, [supabase, feed.id, currentUserProfile]);

  const handleReact = async (tipo: FeedReacaoTipo) => {
    // Find if user already reacted with this emoji
    const existing = reactions.find((r) => r.tipo_reacao === tipo);
    const active = !!existing?.active;

    // Optimistic UI updates
    setReactions((prev) =>
      prev.map((r) => {
        if (r.tipo_reacao === tipo) {
          return {
            ...r,
            count: active ? Math.max(0, r.count - 1) : r.count + 1,
            active: !active,
          };
        }
        return r;
      })
    );

    try {
      if (active) {
        // Remove reaction
        const res = await fetch(`/api/feeds/${feed.id}/reacoes?comentario_id=`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error();
      } else {
        // Add reaction
        const res = await fetch(`/api/feeds/${feed.id}/reacoes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tipo_reacao: tipo }),
        });
        if (!res.ok) throw new Error();
      }
    } catch (err) {
      toast.error('Falha ao processar reação');
      // Rollback
      setReactions((prev) =>
        prev.map((r) => {
          if (r.tipo_reacao === tipo) {
            return {
              ...r,
              count: active ? r.count + 1 : Math.max(0, r.count - 1),
              active: active,
            };
          }
          return r;
        })
      );
    }
  };

  const handlePin = async () => {
    try {
      const res = await fetch(`/api/feeds/${feed.id}/fixar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixado: !feed.fixado }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(feed.fixado ? 'Postagem desafixada do topo' : 'Postagem fixada no topo');
      onUpdate(data.feed);
    } catch (err: any) {
      toast.error(err.message || 'Falha ao fixar postagem');
    }
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || !editContent.trim()) {
      toast.error('Título e Conteúdo são obrigatórios');
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/feeds/${feed.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: editTitle, conteudo: editContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success('Publicação atualizada com sucesso');
      setIsEditing(false);
      onUpdate(data.feed);
    } catch (err: any) {
      toast.error(err.message || 'Falha ao salvar edição');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Tem certeza de que deseja remover esta postagem do Feed?')) return;

    try {
      const res = await fetch(`/api/feeds/${feed.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();

      toast.success('Postagem excluída do Feed');
      onDelete(feed.id);
    } catch (err) {
      toast.error('Falha ao excluir postagem');
    }
  };

  const formattedDate = new Date(feed.criado_em).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isSystemPost = feed.tipo === 'sistema';
  const isAdmin = currentUserProfile?.role === 'admin' || currentUserProfile?.role === 'manager';
  const isAuthor = currentUserProfile && feed.autor_id === currentUserProfile.id;

  // RULE 2: Edit allowed only up to 15 minutes after creation
  const createdTime = new Date(feed.criado_em).getTime();
  const diffMinutes = (Date.now() - createdTime) / 60000;
  const canEdit = isAuthor && !isSystemPost && diffMinutes <= 15;

  return (
    <div
      className={`glass rounded-xl border p-4 shadow-lg transition-all relative ${
        feed.fixado
          ? 'border-emerald-500 bg-emerald-950/10'
          : isSystemPost
          ? 'border-l-4 border-l-violet-500 border-slate-800 bg-slate-900/30'
          : 'border-slate-800 bg-slate-900/40 hover:border-slate-700/80'
      }`}
    >
      {/* Top Header Card */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {isSystemPost ? (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600/10 border border-violet-600/20 text-violet-400">
              <Shield className="size-4 animate-pulse" />
            </div>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600/10 border border-emerald-600/20 text-emerald-400 font-bold">
              {feed.autor ? feed.autor.full_name.charAt(0).toUpperCase() : <User className="size-4" />}
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-white">
                {isSystemPost ? 'Atividade do CRM' : feed.autor?.full_name || 'Usuário Alexis'}
              </span>
              {isSystemPost && (
                <Badge variant="outline" className="bg-violet-600/10 text-violet-400 border-violet-600/20 text-[10px] uppercase font-bold py-0.5">
                  CRM
                </Badge>
              )}
              {feed.fixado && (
                <Badge className="bg-emerald-600 text-white border-0 text-[10px] font-bold py-0.5 flex items-center gap-0.5">
                  <Pin className="size-2.5 shrink-0" />
                  Fixado
                </Badge>
              )}
              <span className="text-[10px] text-slate-500 uppercase">{feed.categoria}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
              <Clock className="size-3 text-slate-500" />
              <span>{formattedDate}</span>
              {feed.editado && <span className="text-[10px] text-slate-500 font-medium">(Editado)</span>}
            </div>
          </div>
        </div>

        {/* Dropdown Options */}
        <DropdownMenu>
          <DropdownMenuTrigger className="h-8 w-8 text-slate-400 hover:text-white rounded-lg flex items-center justify-center transition-colors cursor-pointer select-none">
          <ChevronDown className="size-4" />
        </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-slate-900 border-slate-800">
            {isAdmin && (
              <DropdownMenuItem
                onClick={handlePin}
                className="text-slate-300 focus:bg-slate-800 focus:text-white text-xs gap-2"
              >
                <Pin className="size-3.5" />
                {feed.fixado ? 'Desafixar do topo' : 'Fixar no topo'}
              </DropdownMenuItem>
            )}
            {canEdit && (
              <DropdownMenuItem
                onClick={() => setIsEditing(true)}
                className="text-slate-300 focus:bg-slate-800 focus:text-white text-xs gap-2"
              >
                <Edit2 className="size-3.5" />
                Editar publicação
              </DropdownMenuItem>
            )}
            {(isAuthor || isAdmin) && (
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-red-400 focus:bg-red-950/30 focus:text-red-300 text-xs gap-2"
              >
                <Trash2 className="size-3.5" />
                Excluir publicação
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Title and Content Body */}
      <div className="mt-3 space-y-3 pl-1">
        {isEditing ? (
          <div className="space-y-3">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="bg-slate-950/40 border-slate-800 text-white rounded-lg h-9 text-sm font-semibold"
            />
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={3}
              className="bg-slate-950/40 border-slate-800 text-slate-200 text-sm rounded-lg"
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-white text-xs h-8">
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSaveEdit} disabled={savingEdit} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8">
                {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-base font-bold text-white leading-tight">{feed.titulo}</h3>
            
            {/* Render markdown style strings safely */}
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap select-text">
              {feed.conteudo.split(/(\*\*.*?\*\*|#\w+|@\w+\s\w+)/g).map((chunk, idx) => {
                if (chunk.startsWith('**') && chunk.endsWith('**')) {
                  return <strong key={idx} className="text-white font-extrabold">{chunk.slice(2, -2)}</strong>;
                }
                if (chunk.startsWith('#')) {
                  return <span key={idx} className="text-emerald-400 font-semibold">{chunk}</span>;
                }
                if (chunk.startsWith('@')) {
                  return <span key={idx} className="text-violet-400 font-semibold">{chunk}</span>;
                }
                return chunk;
              })}
            </p>
          </>
        )}
      </div>

      {/* Render attachments */}
      {feed.anexos && feed.anexos.length > 0 && (
        <div className="mt-3 grid gap-2 pl-1 border-t border-slate-800/10 pt-2">
          {feed.anexos.map((url, idx) => (
            <a
              key={idx}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors w-fit bg-slate-950/20 px-2.5 py-1 rounded-lg border border-slate-800"
            >
              <Paperclip className="size-3" />
              <span className="truncate max-w-xs">{url}</span>
              <ExternalLink className="size-2.5" />
            </a>
          ))}
        </div>
      )}

      {/* Dynamic Linked Entities */}
      {feed.entidade_relacionada_tipo && feed.entidade_relacionada_id && (
        <div className="mt-3 p-2 rounded-lg bg-slate-950/30 border border-slate-800/80 flex items-center justify-between text-xs pl-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">Registro Vinculado:</span>
            <Badge variant="outline" className="bg-violet-600/15 text-violet-400 border-violet-600/25 uppercase text-[9px] font-extrabold">
              {feed.entidade_relacionada_tipo === 'venda' ? 'Negócio' : 'Contato'}
            </Badge>
            <span className="font-mono text-slate-500">{feed.entidade_relacionada_id.slice(0, 18)}...</span>
          </div>
          <a
            href={feed.entidade_relacionada_tipo === 'venda' ? '/pipelines' : '/contacts'}
            className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 hover:underline transition-all"
          >
            Abrir no CRM
            <ExternalLink className="size-3" />
          </a>
        </div>
      )}

      {/* Reactions and Action buttons */}
      <div className="mt-4 border-t border-slate-800/30 pt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Reaction picker dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 px-3 border border-slate-800 bg-slate-900/30 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg text-xs gap-1 transition-colors cursor-pointer select-none">
            <Smile className="size-3.5" />
            Interagir
          </DropdownMenuTrigger>
            <DropdownMenuContent className="p-1 bg-slate-900 border-slate-800 flex gap-1">
              {Object.entries(REACTION_EMOJIS).map(([tipo, emoji]) => (
                <button
                  key={tipo}
                  onClick={() => handleReact(tipo as FeedReacaoTipo)}
                  className="h-8 w-8 text-lg flex items-center justify-center rounded hover:bg-slate-800 transition-colors"
                  title={REACTION_LABELS[tipo as FeedReacaoTipo]}
                >
                  {emoji}
                </button>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Active Reaction Counters */}
          {!loadingReactions &&
            reactions
              .filter((r) => r.count > 0)
              .map((r) => (
                <button
                  key={r.tipo_reacao}
                  onClick={() => handleReact(r.tipo_reacao)}
                  className={`inline-flex items-center gap-1 h-7 px-2 border text-xs font-semibold rounded-lg transition-all ${
                    r.active
                      ? 'bg-emerald-600/15 border-emerald-500/30 text-emerald-400'
                      : 'bg-slate-950/20 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span>{REACTION_EMOJIS[r.tipo_reacao]}</span>
                  <span>{r.count}</span>
                </button>
              ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowComments(!showComments)}
          className="h-7 text-xs text-slate-400 hover:text-white hover:bg-slate-800/40 rounded-lg gap-1 border border-transparent hover:border-slate-800"
        >
          <MessageSquare className="size-3.5" />
          <span>Comentar</span>
          {showComments ? <ChevronUp className="size-3 ml-0.5" /> : <ChevronDown className="size-3 ml-0.5" />}
        </Button>
      </div>

      {/* Comment Section Thread */}
      {showComments && (
        <div className="mt-4 border-t border-slate-800/40 pt-4">
          <FeedCommentSection feedId={feed.id} currentUserProfile={currentUserProfile} />
        </div>
      )}
    </div>
  );
}
