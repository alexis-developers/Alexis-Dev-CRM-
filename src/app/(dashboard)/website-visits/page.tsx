'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Plus, MoreHorizontal, Pencil, Trash2, Loader2, Monitor,
  Search, Globe, Clock, Star, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WebsiteVisit {
  id: string;
  user_id: string;
  contact_id?: string;
  visitor_name?: string;
  visitor_email?: string;
  page_url?: string;
  page_title?: string;
  referrer?: string;
  source?: string;
  browser?: string;
  os?: string;
  first_visit_at: string;
  last_visit_at: string;
  visit_count: number;
  total_time_seconds: number;
  visitor_score: number;
  created_at: string;
  updated_at: string;
}

const PAGE_SIZE = 20;

function formatTime(seconds: number) {
  if (!seconds) return '0s';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function getScoreColor(score: number) {
  if (score >= 80) return 'text-green-400';
  if (score >= 50) return 'text-yellow-400';
  if (score >= 20) return 'text-orange-400';
  return 'text-slate-400';
}

export default function WebsiteVisitsPage() {
  const supabase = createClient();

  const [visits, setVisits] = useState<WebsiteVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editVisit, setEditVisit] = useState<WebsiteVisit | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WebsiteVisit | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPageUrl, setFormPageUrl] = useState('');
  const [formPageTitle, setFormPageTitle] = useState('');
  const [formSource, setFormSource] = useState('');
  const [formBrowser, setFormBrowser] = useState('');
  const [formOs, setFormOs] = useState('');
  const [formVisitCount, setFormVisitCount] = useState('1');
  const [formTotalTime, setFormTotalTime] = useState('0');
  const [formScore, setFormScore] = useState('0');

  const fetchVisits = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('website_visits')
      .select('*')
      .order('last_visit_at', { ascending: false });
    if (error) { toast.error('Falha ao carregar visitas'); setLoading(false); return; }
    let filtered = (data ?? []) as unknown as WebsiteVisit[];
    if (search.trim()) {
      const term = search.toLowerCase();
      filtered = filtered.filter(
        (v) =>
          v.visitor_name?.toLowerCase().includes(term) ||
          v.visitor_email?.toLowerCase().includes(term) ||
          v.page_url?.toLowerCase().includes(term) ||
          v.source?.toLowerCase().includes(term),
      );
    }
    setVisits(filtered as unknown as WebsiteVisit[]);
    setLoading(false);
  }, [supabase, search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchVisits();
  }, [fetchVisits]);

  function openAdd() {
    setEditVisit(null);
    setFormName('');
    setFormEmail('');
    setFormPageUrl('');
    setFormPageTitle('');
    setFormSource('');
    setFormBrowser('');
    setFormOs('');
    setFormVisitCount('1');
    setFormTotalTime('0');
    setFormScore('0');
    setFormOpen(true);
  }

  function openEdit(visit: WebsiteVisit) {
    setEditVisit(visit);
    setFormName(visit.visitor_name ?? '');
    setFormEmail(visit.visitor_email ?? '');
    setFormPageUrl(visit.page_url ?? '');
    setFormPageTitle(visit.page_title ?? '');
    setFormSource(visit.source ?? '');
    setFormBrowser(visit.browser ?? '');
    setFormOs(visit.os ?? '');
    setFormVisitCount(String(visit.visit_count ?? 1));
    setFormTotalTime(String(visit.total_time_seconds ?? 0));
    setFormScore(String(visit.visitor_score ?? 0));
    setFormOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      visitor_name: formName.trim() || null,
      visitor_email: formEmail.trim() || null,
      page_url: formPageUrl.trim() || null,
      page_title: formPageTitle.trim() || null,
      source: formSource.trim() || null,
      browser: formBrowser.trim() || null,
      os: formOs.trim() || null,
      visit_count: parseInt(formVisitCount) || 1,
      total_time_seconds: parseInt(formTotalTime) || 0,
      visitor_score: parseInt(formScore) || 0,
      last_visit_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (editVisit) {
      const { error } = await supabase.from('website_visits').update(payload).eq('id', editVisit.id);
      if (error) toast.error('Falha ao atualizar visita');
      else { toast.success('Visita atualizada'); setFormOpen(false); fetchVisits(); }
    } else {
      const { error } = await supabase.from('website_visits').insert({
        ...payload,
        first_visit_at: new Date().toISOString(),
      });
      if (error) toast.error('Falha ao registrar visita');
      else { toast.success('Visita registrada'); setFormOpen(false); fetchVisits(); }
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('website_visits').delete().eq('id', deleteTarget.id);
    if (error) toast.error('Falha ao excluir visita');
    else { toast.success('Visita excluída'); fetchVisits(); }
    setDeleting(false);
    setDeleteConfirmOpen(false);
  }

  const totalVisits = visits.reduce((s, v) => s + v.visit_count, 0);
  const avgScore = visits.length > 0 ? Math.round(visits.reduce((s, v) => s + v.visitor_score, 0) / visits.length) : 0;
  const uniqueVisitors = visits.length;

  const paged = visits.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(visits.length / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Visitas no Site</h1>
          <p className="text-sm text-slate-400 mt-1">Rastreamento de visitantes e comportamento no site</p>
        </div>
        <Button onClick={openAdd} className="bg-violet-600 hover:bg-violet-700 text-white">
          <Plus className="size-4" />Registrar Visita
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="size-4 text-blue-400" />
            <p className="text-xs text-slate-500">Total de Visitas</p>
          </div>
          <p className="text-2xl font-bold text-white">{totalVisits}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Monitor className="size-4 text-violet-400" />
            <p className="text-xs text-slate-500">Visitantes Únicos</p>
          </div>
          <p className="text-2xl font-bold text-white">{uniqueVisitors}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Star className="size-4 text-yellow-400" />
            <p className="text-xs text-slate-500">Pontuação Média</p>
          </div>
          <p className={`text-2xl font-bold ${getScoreColor(avgScore)}`}>{avgScore}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
        <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Buscar por visitante, URL, fonte..." className="pl-8 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500" />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="text-slate-400">Visitante</TableHead>
              <TableHead className="text-slate-400 hidden md:table-cell">Página</TableHead>
              <TableHead className="text-slate-400 hidden sm:table-cell">Visitas</TableHead>
              <TableHead className="text-slate-400 hidden lg:table-cell">Tempo Total</TableHead>
              <TableHead className="text-slate-400 hidden lg:table-cell">Fonte</TableHead>
              <TableHead className="text-slate-400">Pontuação</TableHead>
              <TableHead className="text-slate-400 hidden xl:table-cell">Última Visita</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-slate-800">
                <TableCell colSpan={8} className="text-center py-12">
                  <Loader2 className="size-6 animate-spin text-violet-500 mx-auto" />
                </TableCell>
              </TableRow>
            ) : paged.length === 0 ? (
              <TableRow className="border-slate-800">
                <TableCell colSpan={8} className="text-center py-12">
                  <Monitor className="size-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-500">Nenhuma visita registrada.</p>
                </TableCell>
              </TableRow>
            ) : paged.map((visit) => (
              <TableRow key={visit.id} className="border-slate-800 hover:bg-slate-900/50">
                <TableCell>
                  <div>
                    <p className="text-white font-medium text-sm">
                      {visit.visitor_name ?? <span className="text-slate-500 italic">Anônimo</span>}
                    </p>
                    {visit.visitor_email && (
                      <p className="text-xs text-slate-500">{visit.visitor_email}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="max-w-xs">
                    {visit.page_title && <p className="text-slate-300 text-xs truncate">{visit.page_title}</p>}
                    {visit.page_url && (
                      <p className="text-slate-600 text-[10px] truncate font-mono">{visit.page_url}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <span className="text-white font-mono text-sm">{visit.visit_count}</span>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <span className="flex items-center gap-1 text-slate-400 text-sm">
                    <Clock className="size-3" />
                    {formatTime(visit.total_time_seconds)}
                  </span>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-slate-400 text-sm">
                  {visit.source ?? <span className="text-slate-600">-</span>}
                </TableCell>
                <TableCell>
                  <span className={`font-bold ${getScoreColor(visit.visitor_score)}`}>
                    {visit.visitor_score}
                  </span>
                </TableCell>
                <TableCell className="hidden xl:table-cell text-slate-500 text-xs">
                  {format(new Date(visit.last_visit_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="text-slate-400 hover:text-white" />}>
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                      <DropdownMenuItem onClick={() => openEdit(visit)} className="text-slate-300 focus:bg-slate-800"><Pencil className="size-4" />Editar</DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-slate-700" />
                      <DropdownMenuItem variant="destructive" onClick={() => { setDeleteTarget(visit); setDeleteConfirmOpen(true); }}>
                        <Trash2 className="size-4" />Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">Exibindo {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, visits.length)} de {visits.length}</p>
          <div className="flex gap-1">
            <Button variant="outline" size="icon-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}
              className="border-slate-700 text-slate-400 hover:bg-slate-800 disabled:opacity-30">
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="icon-sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}
              className="border-slate-700 text-slate-400 hover:bg-slate-800 disabled:opacity-30">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">{editVisit ? 'Editar Visita' : 'Registrar Visita'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-slate-300">Nome do Visitante</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)}
                placeholder="Nome" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Email</Label>
              <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)}
                placeholder="email@exemplo.com" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-slate-300">URL da Página</Label>
              <Input value={formPageUrl} onChange={(e) => setFormPageUrl(e.target.value)}
                placeholder="https://exemplo.com/pagina" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-slate-300">Título da Página</Label>
              <Input value={formPageTitle} onChange={(e) => setFormPageTitle(e.target.value)}
                placeholder="Título" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Fonte/Origem</Label>
              <Input value={formSource} onChange={(e) => setFormSource(e.target.value)}
                placeholder="Google, Direct..." className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Navegador</Label>
              <Input value={formBrowser} onChange={(e) => setFormBrowser(e.target.value)}
                placeholder="Chrome, Firefox..." className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Nº de Visitas</Label>
              <Input type="number" min="1" value={formVisitCount} onChange={(e) => setFormVisitCount(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Tempo Total (seg)</Label>
              <Input type="number" min="0" value={formTotalTime} onChange={(e) => setFormTotalTime(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-slate-300">Pontuação do Visitante (0–100)</Label>
              <Input type="number" min="0" max="100" value={formScore} onChange={(e) => setFormScore(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editVisit ? 'Salvar' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Excluir Visita</DialogTitle>
            <DialogDescription className="text-slate-400">Tem certeza que deseja excluir este registro de visita?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800">Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="size-4 animate-spin" />}Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
