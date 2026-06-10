'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  MessageSquare,
  Users,
  Lock,
  Globe,
  Plus,
  Smile,
  Tag,
  Paperclip,
  Loader2,
  X,
  Sparkles,
  Link,
  ChevronDown,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Profile, FeedPostCategoria, FeedPostVisibilidade } from '@/types';

// Curated list of high-quality emojis
const POPULAR_EMOJIS = [
  '👍', '❤️', '🎉', '⚠️', '😂', '👀', '🔥', '🚀',
  '💬', '💡', '👏', '🎯', '✅', '❌', '📅', '🌟',
  '🙌', '💼', '💻', '📣', '🤝', '🔒', '🏆', '💯'
];

const CATEGORIES: { value: FeedPostCategoria; label: string; icon: string }[] = [
  { value: 'comentario_geral', label: 'Discussão Geral', icon: '💬' },
  { value: 'venda', label: 'Venda / Negócio', icon: '💰' },
  { value: 'contato', label: 'Contato', icon: '👤' },
  { value: 'chamada', label: 'Chamada', icon: '📞' },
  { value: 'tarefa', label: 'Tarefa', icon: '📋' },
  { value: 'visita_site', label: 'Visita ao Site', icon: '🌐' },
  { value: 'outros', label: 'Outros', icon: '✨' },
];

const VISIBILITY_OPTIONS: { value: FeedPostVisibilidade; label: string; icon: any }[] = [
  { value: 'publico', label: 'Público (Toda a empresa)', icon: Globe },
  { value: 'equipe', label: 'Equipe (Departamento)', icon: Users },
  { value: 'privado', label: 'Privado (Apenas eu e mencionados)', icon: Lock },
];

interface FeedComposerProps {
  onSuccess: (newPost: any) => void;
}

export function FeedComposer({ onSuccess }: FeedComposerProps) {
  const supabase = createClient();
  const [publishing, setPublishing] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [categoria, setCategoria] = useState<FeedPostCategoria>('comentario_geral');
  const [visibilidade, setVisibilidade] = useState<FeedPostVisibilidade>('publico');
  
  // Attachments and Tags
  const [attachments, setAttachments] = useState<string[]>([]);
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [showAttachmentInput, setShowAttachmentInput] = useState(false);
  
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  
  // Link CRM entity
  const [crmType, setCrmType] = useState<'venda' | 'contato' | null>(null);
  const [crmId, setCrmId] = useState('');
  const [showCrmInput, setShowCrmInput] = useState(false);

  // Mentions (@attendants)
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filteredProfiles, setFilteredProfiles] = useState<Profile[]>([]);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mencoes, setMencoes] = useState<string[]>([]); // profile IDs mentioned
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Load active profiles for @mention auto-complete
    async function loadProfiles() {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');
      if (data) setProfiles(data as Profile[]);
    }
    loadProfiles();
  }, [supabase]);

  // Handle content typing and detect '@' mentions
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setConteudo(val);

    const words = val.split(/\s/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith('@')) {
      const search = lastWord.slice(1).toLowerCase();
      setMentionSearch(search);
      const filtered = profiles.filter(
        (p) =>
          p.full_name.toLowerCase().includes(search) ||
          p.email.toLowerCase().includes(search)
      );
      setFilteredProfiles(filtered);
      setShowMentionList(filtered.length > 0);
    } else {
      setShowMentionList(false);
    }
  };

  const handleSelectMention = (profile: Profile) => {
    const words = conteudo.split(/\s/);
    words.pop(); // Remove the partial mention word '@name'
    const newContent = [...words, `@${profile.full_name} `].join(' ');
    setConteudo(newContent);
    setShowMentionList(false);

    if (!mencoes.includes(profile.id)) {
      setMencoes([...mencoes, profile.id]);
    }
    
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleAddEmoji = (emoji: string) => {
    setConteudo((prev) => prev + emoji);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleAddAttachment = () => {
    if (newAttachmentUrl.trim()) {
      if (!attachments.includes(newAttachmentUrl.trim())) {
        setAttachments([...attachments, newAttachmentUrl.trim()]);
      }
      setNewAttachmentUrl('');
      setShowAttachmentInput(false);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim()) {
      const cleanTag = newTag.trim().toLowerCase().replace('#', '');
      if (!tags.includes(cleanTag)) {
        setTags([...tags, cleanTag]);
      }
      setNewTag('');
      setShowTagInput(false);
    }
  };

  const handlePublish = async () => {
    if (!titulo.trim()) {
      toast.error('O título do post é obrigatório');
      return;
    }
    if (!conteudo.trim()) {
      toast.error('O conteúdo do post é obrigatório');
      return;
    }

    setPublishing(true);
    try {
      const res = await fetch('/api/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: categoria === 'venda' || categoria === 'contato' || categoria === 'chamada' ? 'sistema' : 'manual',
          categoria,
          titulo: titulo.trim(),
          conteudo: conteudo.trim(),
          visibilidade,
          anexos: attachments,
          mencoes,
          tags,
          entidade_relacionada_tipo: crmType,
          entidade_relacionada_id: crmId.trim() || null,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Falha ao publicar post');
      }

      toast.success('Publicação realizada com sucesso!');
      setTitulo('');
      setConteudo('');
      setAttachments([]);
      setTags([]);
      setMencoes([]);
      setCrmType(null);
      setCrmId('');
      onSuccess(body.feed);
    } catch (err: any) {
      console.error('Publish error:', err);
      toast.error(err.message || 'Falha ao publicar postagem');
    } finally {
      setPublishing(false);
    }
  };

  const currentCategory = CATEGORIES.find((c) => c.value === categoria) || CATEGORIES[0];
  const currentVisibility = VISIBILITY_OPTIONS.find((v) => v.value === visibilidade) || VISIBILITY_OPTIONS[0];
  const VisibilityIcon = currentVisibility.icon;

  return (
    <div className="glass rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-4 shadow-xl relative overflow-visible">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-emerald-400 animate-pulse" />
          <span className="text-sm font-semibold text-white">Criar Nova Publicação</span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Categoria Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 text-xs px-3 border border-slate-800 bg-slate-900/50 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer select-none">
                <span className="mr-1">{currentCategory.icon}</span>
                {currentCategory.label}
                <ChevronDown className="size-3 ml-1 text-slate-500" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-slate-900 border-slate-800">
              {CATEGORIES.map((cat) => (
                <DropdownMenuItem
                  key={cat.value}
                  onClick={() => setCategoria(cat.value)}
                  className="text-slate-300 focus:bg-slate-800 focus:text-white text-xs gap-2"
                >
                  <span>{cat.icon}</span>
                  {cat.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Visibilidade Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 text-xs px-3 border border-slate-800 bg-slate-900/50 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer select-none">
                <VisibilityIcon className="size-3 mr-1 text-emerald-400" />
                {currentVisibility.label.split(' ')[0]}
                <ChevronDown className="size-3 ml-1 text-slate-500" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-slate-900 border-slate-800">
              {VISIBILITY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => setVisibilidade(opt.value)}
                    className="text-slate-300 focus:bg-slate-800 focus:text-white text-xs gap-2"
                  >
                    <Icon className="size-3.5 text-emerald-400" />
                    {opt.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-3">
        <Input
          placeholder="Título da publicação..."
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="bg-slate-950/40 border-slate-800 text-white placeholder:text-slate-500 font-medium rounded-lg h-9 text-sm"
        />

        <div className="relative">
          <Textarea
            ref={textareaRef}
            placeholder="No que você está trabalhando hoje? Escreva aqui... Use @ para mencionar e # para tags."
            value={conteudo}
            onChange={handleContentChange}
            rows={3}
            className="bg-slate-950/40 border-slate-800 text-slate-200 placeholder:text-slate-500 text-sm resize-none rounded-lg focus-visible:ring-emerald-500/20"
          />

          {/* Mention Popover */}
          {showMentionList && (
            <div className="absolute left-0 bottom-full mb-1 w-64 bg-slate-950 border border-slate-800 rounded-xl max-h-48 overflow-y-auto shadow-2xl z-50 p-1">
              <p className="text-[10px] text-slate-500 font-semibold px-2 py-1 uppercase tracking-wider">Mencionar Integrante</p>
              {filteredProfiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectMention(p)}
                  className="w-full flex items-center gap-2 p-2 text-left hover:bg-slate-900 text-xs rounded-lg transition-colors text-slate-300 hover:text-white"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                    {p.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{p.full_name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{p.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Attachment and Tag Pills Displays */}
      {(attachments.length > 0 || tags.length > 0 || crmType) && (
        <div className="flex flex-wrap gap-2 py-1 border-t border-slate-800/30">
          {crmType && (
            <span className="inline-flex items-center gap-1 bg-violet-600/10 text-violet-400 border border-violet-600/20 px-2 py-0.5 rounded-lg text-xs font-semibold">
              <Link className="size-3" />
              CRM: {crmType === 'venda' ? 'Negócio' : 'Contato'} ({crmId.slice(0, 8)})
              <button onClick={() => { setCrmType(null); setCrmId(''); }} className="hover:text-red-400">
                <X className="size-3" />
              </button>
            </span>
          )}
          {attachments.map((url, idx) => (
            <span key={idx} className="inline-flex items-center gap-1 bg-slate-800 text-slate-300 px-2 py-0.5 rounded-lg text-xs">
              <Paperclip className="size-3 shrink-0" />
              <span className="truncate max-w-[120px]">{url}</span>
              <button onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))} className="hover:text-red-400">
                <X className="size-3" />
              </button>
            </span>
          ))}
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 bg-emerald-600/10 text-emerald-400 border border-emerald-600/20 px-2 py-0.5 rounded-lg text-xs font-medium">
              #{tag}
              <button onClick={() => setTags(tags.filter((t) => t !== tag))} className="hover:text-red-400">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Inline dynamic input sheets */}
      {showAttachmentInput && (
        <div className="flex gap-2 p-2 bg-slate-950/30 border border-slate-800/80 rounded-lg items-center">
          <Input
            placeholder="Cole a URL do anexo..."
            value={newAttachmentUrl}
            onChange={(e) => setNewAttachmentUrl(e.target.value)}
            className="h-8 text-xs bg-slate-900 border-slate-800 text-white"
          />
          <Button size="sm" onClick={handleAddAttachment} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">Anexar</Button>
          <Button size="icon" variant="ghost" onClick={() => setShowAttachmentInput(false)} className="h-8 w-8 text-slate-400 hover:text-white"><X className="size-4" /></Button>
        </div>
      )}

      {showTagInput && (
        <div className="flex gap-2 p-2 bg-slate-950/30 border border-slate-800/80 rounded-lg items-center">
          <Input
            placeholder="Nova hashtag (ex: feedback)..."
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            className="h-8 text-xs bg-slate-900 border-slate-800 text-white"
          />
          <Button size="sm" onClick={handleAddTag} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">Adicionar</Button>
          <Button size="icon" variant="ghost" onClick={() => setShowTagInput(false)} className="h-8 w-8 text-slate-400 hover:text-white"><X className="size-4" /></Button>
        </div>
      )}

      {showCrmInput && (
        <div className="flex gap-2 p-2 bg-slate-950/30 border border-slate-800/80 rounded-lg items-center text-xs">
          <select
            value={crmType || 'venda'}
            onChange={(e) => setCrmType(e.target.value as 'venda' | 'contato')}
            className="bg-slate-900 border border-slate-800 text-white rounded p-1 h-8"
          >
            <option value="venda">Negócio / Venda</option>
            <option value="contato">Contato</option>
          </select>
          <Input
            placeholder="UUID do registro no CRM..."
            value={crmId}
            onChange={(e) => setCrmId(e.target.value)}
            className="h-8 text-xs bg-slate-900 border-slate-800 text-white"
          />
          <Button size="sm" onClick={() => { if (crmId.trim()) { setCrmType(crmType || 'venda'); setShowCrmInput(false); } }} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">Vincular</Button>
          <Button size="icon" variant="ghost" onClick={() => { setShowCrmInput(false); setCrmType(null); }} className="h-8 w-8 text-slate-400 hover:text-white"><X className="size-4" /></Button>
        </div>
      )}

      {/* Toolbar / Actions Bar */}
      <div className="flex items-center justify-between border-t border-slate-800/30 pt-3">
        <div className="flex items-center gap-1">
          {/* Emojis Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger className="h-8 w-8 text-slate-400 hover:text-emerald-400 hover:bg-slate-800/40 rounded-lg flex items-center justify-center transition-colors cursor-pointer select-none" title="Inserir Emoji">
                <Smile className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="p-2 w-48 bg-slate-900 border-slate-800 grid grid-cols-6 gap-1">
              {POPULAR_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => handleAddEmoji(e)}
                  className="h-7 w-7 text-sm flex items-center justify-center rounded hover:bg-slate-800 transition-colors"
                >
                  {e}
                </button>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Anexar mídia */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setShowAttachmentInput(!showAttachmentInput); setShowTagInput(false); setShowCrmInput(false); }}
            className="h-8 w-8 text-slate-400 hover:text-emerald-400 hover:bg-slate-800/40 rounded-lg"
            title="Anexar link de mídia"
          >
            <Paperclip className="size-4" />
          </Button>

          {/* Adicionar Hashtag */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setShowTagInput(!showTagInput); setShowAttachmentInput(false); setShowCrmInput(false); }}
            className="h-8 w-8 text-slate-400 hover:text-emerald-400 hover:bg-slate-800/40 rounded-lg"
            title="Adicionar Hashtag"
          >
            <Tag className="size-4" />
          </Button>

          {/* Vincular CRM Registro */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setShowCrmInput(!showCrmInput); setShowAttachmentInput(false); setShowTagInput(false); }}
            className="h-8 w-8 text-slate-400 hover:text-emerald-400 hover:bg-slate-800/40 rounded-lg"
            title="Vincular registro do CRM"
          >
            <Link className="size-4" />
          </Button>
        </div>

        <Button
          onClick={handlePublish}
          disabled={publishing}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 h-8 rounded-lg"
        >
          {publishing ? (
            <>
              <Loader2 className="size-3.5 animate-spin mr-1.5" />
              Publicando...
            </>
          ) : (
            <>
              Publicar
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
