'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  Globe,
  Users,
  Lock,
  Pin,
  TrendingUp,
  Sparkles,
  BarChart3,
  Download,
  Bell,
  CheckCheck,
  Settings2,
  Trophy,
  Loader2,
  Calendar,
  MessageSquare,
  Smile,
  Hash,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { FeedComposer } from '@/components/feeds/feed-composer';
import { FeedPostCard } from '@/components/feeds/feed-post-card';
import type { Feed, Profile, FeedPostCategoria } from '@/types';

type FeedTab = 'timeline' | 'mencoes' | 'fixados' | 'anuncios' | 'analytics';

export default function FeedsPage() {
  const supabase = createClient();
  const { user } = useAuth();
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);

  // States
  const [activeTab, setActiveTab] = useState<FeedTab>('timeline');
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Analytics
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Notifications
  const [unreadCount, setUnreadCount] = useState(0);

  // Search & Filters
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState<string>('todos');

  // Preferences dialog
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [silencedCats, setSilencedCats] = useState<string[]>([]);
  const [notifMencoes, setNotifMencoes] = useState(true);
  const [notifRespostas, setNotifRespostas] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Load User Profile
  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    async function loadProfile() {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (data) setCurrentUserProfile(data as Profile);
    }
    loadProfile();
  }, [user, supabase]);

  // Load feeds based on filters
  const loadFeeds = async () => {
    setLoading(true);
    try {
      let url = '/api/feeds?limit=30';
      if (busca.trim()) {
        url += `&busca=${encodeURIComponent(busca)}`;
      }
      if (categoria !== 'todos') {
        url += `&categoria=${categoria}`;
      }
      if (activeTab === 'fixados') {
        url += '&tipo='; // RLS will filter standard, client side filters pinned
      }

      const res = await fetch(url);
      const data = await res.json();
      
      if (res.ok) {
        let list = data.feeds || [];
        
        // Client side tab filters
        if (activeTab === 'mencoes' && currentUserProfile) {
          list = list.filter((f: Feed) => Array.isArray(f.mencoes) && f.mencoes.includes(currentUserProfile.id));
        } else if (activeTab === 'fixados') {
          list = list.filter((f: Feed) => f.fixado);
        } else if (activeTab === 'anuncios') {
          list = list.filter((f: Feed) => f.tipo === 'anuncio');
        }

        setFeeds(list);
      }
    } catch (err) {
      console.error('Error loading feeds:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeeds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, categoria, busca, currentUserProfile]);

  // Load analytics when switching tab
  useEffect(() => {
    if (activeTab === 'analytics') {
      loadAnalytics();
    }
  }, [activeTab]);

  const loadAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const res = await fetch('/api/feeds/analytics/dashboard');
      const data = await res.json();
      if (res.ok) {
        setAnalyticsData(data);
      }
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // Real-time synchronization subscription
  useEffect(() => {
    if (!user) return;
    
    // Subscribe to Postgres changes on feeds
    const channel = supabase
      .channel('feeds-realtime-timeline')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'feeds' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newFeed = payload.new as Feed;
            // Fetch author profile to append
            supabase
              .from('profiles')
              .select('*')
              .eq('id', newFeed.autor_id)
              .single()
              .then(({ data }) => {
                const completeFeed = { ...newFeed, autor: data || undefined };
                setFeeds((prev) => [completeFeed, ...prev]);
                // Toast system triggers
                if (newFeed.tipo === 'sistema') {
                  toast.info(newFeed.titulo);
                } else {
                  toast.success(`Nova postagem: ${newFeed.titulo}`);
                }
                // Reload unread notification count
                loadNotifications();
              });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Feed;
            if (updated.excluido_em) {
              // Soft deleted
              setFeeds((prev) => prev.filter((f) => f.id !== updated.id));
            } else {
              setFeeds((prev) =>
                prev.map((f) => (f.id === updated.id ? { ...f, ...updated } : f))
              );
            }
          } else if (payload.eventType === 'DELETE') {
            setFeeds((prev) => prev.filter((f) => f.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // Load initial unread counts
    loadNotifications();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, currentUserProfile]);

  const loadNotifications = async () => {
    try {
      const res = await fetch('/api/feeds/notificacoes');
      const data = await res.json();
      if (res.ok) {
        setUnreadCount(data.notifications?.length || 0);
      }
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      const res = await fetch('/api/feeds/notificacoes', { method: 'PUT' });
      if (res.ok) {
        setUnreadCount(0);
        toast.success('Todas as notificações marcadas como lidas');
      }
    } catch (err) {
      toast.error('Falha ao limpar notificações');
    }
  };

  // User preferences loading & saving
  const handleOpenPreferences = async () => {
    setPreferencesOpen(true);
    if (!currentUserProfile) return;
    try {
      const { data } = await supabase
        .from('feed_preferencias_usuario')
        .select('*')
        .eq('usuario_id', currentUserProfile.id)
        .single();
      if (data) {
        setSilencedCats(data.categorias_silenciadas || []);
        setNotifMencoes(data.notificar_mencoes);
        setNotifRespostas(data.notificar_respostas);
      }
    } catch (err) {
      console.error('Error loading preferences:', err);
    }
  };

  const handleSavePreferences = async () => {
    if (!currentUserProfile || !user) return;
    setSavingPrefs(true);
    try {
      const payload = {
        user_id: user.id,
        usuario_id: currentUserProfile.id,
        categorias_silenciadas: silencedCats,
        notificar_mencoes: notifMencoes,
        notificar_respostas: notifRespostas,
      };

      const { error } = await supabase
        .from('feed_preferencias_usuario')
        .upsert(payload, { onConflict: 'user_id, usuario_id' });

      if (error) throw error;
      toast.success('Preferências de notificação salvas com sucesso');
      setPreferencesOpen(false);
    } catch (err) {
      toast.error('Falha ao salvar preferências');
    } finally {
      setSavingPrefs(false);
    }
  };

  // Helper arrays for widgets
  const activeAnnouncements = feeds.filter((f) => f.tipo === 'anuncio').slice(0, 3);
  
  // Extract tags list from currently loaded feeds for Trending section
  const tagFrequency: Record<string, number> = {};
  feeds.forEach((f) => {
    if (Array.isArray(f.tags)) {
      f.tags.forEach((tag) => {
        tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
      });
    }
  });
  const trendingList = Object.entries(tagFrequency)
    .map(([name, count]) => ({ name: `#${name}`, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="size-6 text-emerald-400 animate-pulse" />
            Feeds Colaborativos
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Timeline social e painel de atividades em tempo real da equipe.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              onClick={handleMarkAllNotificationsRead}
              variant="outline"
              size="sm"
              className="border-emerald-600/30 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/15"
            >
              <CheckCheck className="size-4" />
              Limpar ({unreadCount})
            </Button>
          )}

          <Button
            onClick={handleOpenPreferences}
            variant="outline"
            size="sm"
            className="border-slate-800 bg-slate-900 text-slate-300 hover:text-white"
          >
            <Settings2 className="size-4" />
            Preferências
          </Button>

          <Button
            onClick={() => setActiveTab(activeTab === 'analytics' ? 'timeline' : 'analytics')}
            className={`font-semibold ${
              activeTab === 'analytics'
                ? 'bg-violet-600 hover:bg-violet-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
            size="sm"
          >
            {activeTab === 'analytics' ? (
              <>
                <Globe className="size-4" />
                Ver Timeline
              </>
            ) : (
              <>
                <BarChart3 className="size-4" />
                Métricas e Analytics
              </>
            )}
          </Button>
        </div>
      </div>

      {activeTab === 'analytics' ? (
        /* Analytics View */
        <FeedAnalyticsDashboard
          data={analyticsData}
          loading={loadingAnalytics}
          onRefresh={loadAnalytics}
        />
      ) : (
        /* 3-Column Timeline Layout */
        <div className="grid gap-6 lg:grid-cols-[240px_1fr_300px]">
          {/* Left Column: Filter Sidebar */}
          <div className="space-y-4">
            <Card className="bg-slate-900/50 border-slate-800 shadow-xl ring-transparent p-2">
              <div className="space-y-1">
                <button
                  onClick={() => setActiveTab('timeline')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all text-left ${
                    activeTab === 'timeline'
                      ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/10'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  <Globe className="size-4 shrink-0" />
                  Timeline Geral
                </button>

                <button
                  onClick={() => setActiveTab('mencoes')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all text-left relative ${
                    activeTab === 'mencoes'
                      ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/10'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  <Bell className="size-4 shrink-0" />
                  Minhas Menções
                  {unreadCount > 0 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-extrabold text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('fixados')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all text-left ${
                    activeTab === 'fixados'
                      ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/10'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  <Pin className="size-4 shrink-0" />
                  Posts Fixados
                </button>

                <button
                  onClick={() => setActiveTab('anuncios')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all text-left ${
                    activeTab === 'anuncios'
                      ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/10'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  <TrendingUp className="size-4 shrink-0" />
                  Anúncios Oficiais
                </button>
              </div>
            </Card>

            {/* Filter by Category */}
            <Card className="bg-slate-900/50 border-slate-800 shadow-xl p-3 space-y-2.5">
              <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider pl-1">Filtrar Categoria</p>
              <div className="space-y-1">
                {[
                  { val: 'todos', label: 'Todas Categorias' },
                  { val: 'venda', label: 'Vendas / Negócios' },
                  { val: 'contato', label: 'Contatos CRM' },
                  { val: 'comentario_geral', label: 'Discussões' },
                ].map((c) => (
                  <button
                    key={c.val}
                    onClick={() => setCategoria(c.val)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                      categoria === c.val
                        ? 'text-white bg-slate-800 font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/20'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </Card>
          </div>

          {/* Center Column: timeline stream */}
          <div className="space-y-4">
            {/* Publisher Composer */}
            {activeTab === 'timeline' && (
              <FeedComposer
                onSuccess={(newPost) => {
                  setFeeds((prev) => [newPost, ...prev]);
                }}
              />
            )}

            {/* Timline Listing Header */}
            <div className="flex items-center gap-2 bg-slate-950/20 border border-slate-850 p-2.5 rounded-xl justify-between">
              <span className="text-xs text-slate-400">
                Mostrando <strong className="text-white">{feeds.length}</strong> publicações
              </span>
              <Input
                placeholder="Buscar palavra ou hashtag..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-7 text-[11px] max-w-[200px] bg-slate-900 border-slate-800 text-white placeholder:text-slate-600"
              />
            </div>

            {/* Feed Cards stream */}
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="size-8 animate-spin text-emerald-500" />
              </div>
            ) : feeds.length === 0 ? (
              <div className="glass rounded-xl border border-slate-800 bg-slate-900/50 p-12 text-center shadow-lg">
                <p className="text-slate-400 text-sm">Nenhuma postagem encontrada.</p>
                <p className="text-slate-500 text-xs mt-1">Crie a sua primeira postagem manual ou selecione outro filtro.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {feeds.map((feed) => (
                  <FeedPostCard
                    key={feed.id}
                    feed={feed}
                    currentUserProfile={currentUserProfile}
                    onDelete={(deletedId) => {
                      setFeeds((prev) => prev.filter((f) => f.id !== deletedId));
                    }}
                    onUpdate={(updatedFeed) => {
                      setFeeds((prev) =>
                        prev.map((f) => (f.id === updatedFeed.id ? updatedFeed : f))
                      );
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Trending tags & Announcements widgets */}
          <div className="space-y-4">
            {/* Active Announcements widget */}
            {activeAnnouncements.length > 0 && (
              <Card className="bg-slate-900/50 border-slate-800 shadow-xl">
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-xs font-bold text-white flex items-center gap-1.5 uppercase">
                    <Pin className="size-3.5 text-emerald-400 rotate-45 shrink-0" />
                    Comunicados Oficiais
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-3">
                  {activeAnnouncements.map((a) => (
                    <div key={a.id} className="p-2 bg-slate-950/40 rounded-lg border border-slate-850">
                      <p className="font-bold text-white text-xs truncate">{a.titulo}</p>
                      <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{a.conteudo}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Trending tags list */}
            {trendingList.length > 0 && (
              <Card className="bg-slate-900/50 border-slate-800 shadow-xl">
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-xs font-bold text-white flex items-center gap-1.5 uppercase">
                    <TrendingUp className="size-3.5 text-emerald-400 shrink-0" />
                    Hashtags em Alta
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-2">
                  {trendingList.map((tag) => (
                    <div key={tag.name} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/30 last:border-0">
                      <span className="font-semibold text-emerald-400">{tag.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{tag.count} posts</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Preferences Dialog */}
      <Dialog open={preferencesOpen} onOpenChange={(v) => !v && setPreferencesOpen(false)}>
        <DialogContent className="bg-slate-900 border-slate-800 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Preferências de Timeline</DialogTitle>
            <DialogDescription className="text-slate-400">
              Customize suas preferências de visualização e notificações.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-slate-300 font-bold">Notificar em Menções</Label>
                <p className="text-[10px] text-slate-500">Receba alertas em tempo real quando for mencionado.</p>
              </div>
              <Switch checked={notifMencoes} onCheckedChange={setNotifMencoes} />
            </div>

            <div className="flex items-center justify-between border-t border-slate-800/40 pt-3">
              <div>
                <Label className="text-slate-300 font-bold">Notificar em Comentários</Label>
                <p className="text-[10px] text-slate-500">Alertar se alguém responder em suas postagens.</p>
              </div>
              <Switch checked={notifRespostas} onCheckedChange={setNotifRespostas} />
            </div>

            {/* Silenced Categories Selection */}
            <div className="space-y-2 border-t border-slate-800/40 pt-3">
              <Label className="text-slate-300 font-bold">Silenciar Categorias</Label>
              <p className="text-[10px] text-slate-500 mb-2">Desmarque as atividades que não deseja ver na timeline principal:</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'venda', label: 'Vendas' },
                  { value: 'contato', label: 'Contatos' },
                  { value: 'chamada', label: 'Chamadas' },
                  { value: 'tarefa', label: 'Tarefas' },
                ].map((c) => {
                  const isSilenced = silencedCats.includes(c.value);
                  return (
                    <button
                      key={c.value}
                      onClick={() => {
                        if (isSilenced) {
                          setSilencedCats(silencedCats.filter((x) => x !== c.value));
                        } else {
                          setSilencedCats([...silencedCats, c.value]);
                        }
                      }}
                      className={`p-2 rounded-lg border text-left font-semibold transition-all ${
                        isSilenced
                          ? 'border-red-950 bg-red-950/10 text-red-400'
                          : 'border-slate-850 bg-slate-950/20 text-slate-400 hover:text-white'
                      }`}
                    >
                      {c.label} {isSilenced ? '❌ Silenciado' : '✅ Ativo'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="bg-slate-900 border-slate-850 pt-2">
            <Button variant="ghost" onClick={() => setPreferencesOpen(false)} className="text-slate-400 hover:text-white">
              Cancelar
            </Button>
            <Button onClick={handleSavePreferences} disabled={savingPrefs} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {savingPrefs ? 'Salvando...' : 'Salvar Preferências'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Embedded High-fidelity Analytics view component
interface AnalyticsProps {
  data: any;
  loading: boolean;
  onRefresh: () => void;
}

function FeedAnalyticsDashboard({ data, loading, onRefresh }: AnalyticsProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-2">
        <Loader2 className="size-8 animate-spin text-emerald-500" />
        <span className="text-xs text-slate-500">Compilando estatísticas de timeline...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl">
        <p className="text-slate-400">Nenhum dado analítico compilado ainda.</p>
        <Button onClick={onRefresh} className="mt-4 bg-emerald-600 text-white">Carregar Dashboard</Button>
      </div>
    );
  }

  const { summary, activityChartData, leaderboard, categoryBreakdown, trendingTags } = data;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Aggregates Cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Publicações', val: summary.posts, icon: Globe, border: 'border-l-emerald-500' },
          { label: 'Comentários', val: summary.comments, icon: MessageSquare, border: 'border-l-violet-500' },
          { label: 'Reações', val: summary.reactions, icon: Smile, border: 'border-l-amber-500' },
          { label: 'Atividades Totais', val: summary.totalActivity, icon: Sparkles, border: 'border-l-blue-500' },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className={`bg-slate-900/50 border border-slate-800 border-l-4 ${c.border} shadow-lg`}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-extrabold uppercase tracking-wide">{c.label}</p>
                  <p className="text-2xl font-black text-white mt-1 font-mono">{c.val}</p>
                </div>
                <div className="h-9 w-9 rounded-lg bg-slate-950/40 flex items-center justify-center text-slate-400 border border-slate-800">
                  <Icon className="size-4 text-emerald-400" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
        {/* Activity heat bar chart (Visual responsive SVG) */}
        <Card className="bg-slate-900/50 border border-slate-800 shadow-xl">
          <CardHeader className="p-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-1">
                <Calendar className="size-4 text-emerald-400" />
                Atividades Diárias (Últimos 7 Dias)
              </CardTitle>
              <CardDescription className="text-[10px] text-slate-500 font-medium">Histórico recente de posts, comentários e reações.</CardDescription>
            </div>
            <a
              href="/api/feeds/analytics/exportar"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 border border-emerald-600/30 px-3 py-1 rounded-lg bg-emerald-600/5 hover:bg-emerald-600/10 transition-all hover:underline"
            >
              <Download className="size-3" />
              Exportar CSV
            </a>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {/* Custom high fidelity SVG chart */}
            <div className="h-64 w-full bg-slate-950/20 rounded-xl border border-slate-850 p-4 flex flex-col justify-between">
              <div className="flex-1 flex items-end justify-between gap-2 px-2">
                {activityChartData.map((d: any) => {
                  const max = Math.max(...activityChartData.map((x: any) => x.posts + x.comments + x.reactions), 1);
                  const total = d.posts + d.comments + d.reactions;
                  const heightPct = `${(total / max) * 100}%`;
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-2 group relative">
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-1 bg-slate-950 border border-slate-800 p-2 rounded-lg text-[9px] text-slate-300 font-medium hidden group-hover:block z-50 shadow-2xl min-w-[100px]">
                        <p className="font-bold text-white border-b border-slate-800 pb-0.5 mb-1">{d.date}</p>
                        <p className="flex justify-between">Posts: <span className="font-bold text-emerald-400">{d.posts}</span></p>
                        <p className="flex justify-between">Comments: <span className="font-bold text-violet-400">{d.comments}</span></p>
                        <p className="flex justify-between">Reactions: <span className="font-bold text-amber-400">{d.reactions}</span></p>
                      </div>

                      <div className="w-full flex flex-col justify-end gap-0.5 rounded-lg overflow-hidden transition-all bg-slate-900/40" style={{ height: '140px' }}>
                        <div className="w-full bg-emerald-500" style={{ height: `${(d.posts / max) * 100}%` }} />
                        <div className="w-full bg-violet-500" style={{ height: `${(d.comments / max) * 100}%` }} />
                        <div className="w-full bg-amber-500" style={{ height: `${(d.reactions / max) * 100}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 font-mono mt-1 shrink-0">{d.date}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-4 border-t border-slate-800/40 pt-3 text-[10px] font-semibold text-slate-500">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-emerald-500" /> Publicações</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-violet-500" /> Comentários</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-amber-500" /> Reações</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Active Users Leaderboard */}
        <Card className="bg-slate-900/50 border border-slate-800 shadow-xl">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-1">
              <Trophy className="size-4 text-emerald-400" />
              Ranking de Engajamento
            </CardTitle>
            <CardDescription className="text-[10px] text-slate-500">Usuários mais ativos na timeline social.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            {leaderboard.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-4 pl-1">Ainda sem engajamentos suficientes.</p>
            ) : (
              leaderboard.map((user: any, idx: number) => (
                <div key={user.profile.id} className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded-xl border border-slate-850 hover:border-slate-800/80 transition-all">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-black font-mono w-4 ${idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-slate-300' : 'text-slate-500'}`}>
                      #{idx + 1}
                    </span>
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 font-extrabold text-xs">
                      {user.profile.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white leading-none">{user.profile.full_name}</p>
                      <p className="text-[9px] text-slate-500 mt-1">{user.posts} posts · {user.comments} comments</p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-600/10 text-emerald-400 border border-emerald-600/20 text-[10px] font-black font-mono">
                    {user.score} pts
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Category breakdown visual stats */}
        <Card className="bg-slate-900/50 border border-slate-800 shadow-xl">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-extrabold text-white uppercase tracking-wider">
              Distribuição por Categoria
            </CardTitle>
            <CardDescription className="text-[10px] text-slate-500">Visualização de atividades catalogadas.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            {categoryBreakdown.map((item: any) => (
              <div key={item.name} className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-slate-300">
                  <span>{item.name}</span>
                  <span className="font-mono text-white">{item.value}</span>
                </div>
                <div className="h-2 w-full bg-slate-950/40 rounded-full overflow-hidden border border-slate-850">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{
                      width: `${
                        Math.max(...categoryBreakdown.map((x: any) => x.value)) > 0
                          ? (item.value / Math.max(...categoryBreakdown.map((x: any) => x.value))) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Trending tags frequency list widget */}
        <Card className="bg-slate-900/50 border border-slate-800 shadow-xl">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-1">
              <Hash className="size-4 text-emerald-400" />
              Hashtags Populares
            </CardTitle>
            <CardDescription className="text-[10px] text-slate-500">As hashtags mais usadas em publicações manuais.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            {trendingTags.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-4 pl-1">Nenhuma hashtag indexada.</p>
            ) : (
              trendingTags.map((tag: any) => (
                <div key={tag.name} className="flex justify-between items-center p-2.5 bg-slate-950/40 rounded-xl border border-slate-850 text-xs">
                  <span className="font-extrabold text-emerald-400">{tag.name}</span>
                  <Badge variant="outline" className="bg-slate-900 text-slate-400 border-slate-800 font-mono">
                    {tag.count} {tag.count === 1 ? 'publicacao' : 'publicacoes'}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
