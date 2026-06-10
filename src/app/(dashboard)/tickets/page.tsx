'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Plus, MoreHorizontal, Pencil, Trash2, Loader2, Headphones,
  Search, MessageSquare, ChevronLeft, ChevronRight, Send,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  description?: string;
  status: string;
  priority: string;
  contact_id?: string;
  assigned_to?: string;
  resolved_at?: string;
  closed_at?: string;
  created_at: string;
  updated_at: string;
}

interface TicketComment {
  id: string;
  ticket_id: string;
  user_id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
}

const STATUSES = [
  { value: 'aberto', label: 'Aberto', color: 'text-blue-400 bg-blue-500/10' },
  { value: 'em_andamento', label: 'Em Andamento', color: 'text-yellow-400 bg-yellow-500/10' },
  { value: 'aguardando_cliente', label: 'Aguardando Cliente', color: 'text-orange-400 bg-orange-500/10' },
  { value: 'resolvido', label: 'Resolvido', color: 'text-green-400 bg-green-500/10' },
  { value: 'fechado', label: 'Fechado', color: 'text-slate-400 bg-slate-700' },
  { value: 'escalado', label: 'Escalado', color: 'text-red-400 bg-red-500/10' },
];

const PRIORITIES = [
  { value: 'baixa', label: 'Baixa', color: 'text-slate-400' },
  { value: 'media', label: 'Média', color: 'text-blue-400' },
  { value: 'alta', label: 'Alta', color: 'text-orange-400' },
  { value: 'urgente', label: 'Urgente', color: 'text-red-400' },
];

function getStatus(s: string) { return STATUSES.find((x) => x.value === s) ?? STATUSES[0]; }
function getPriority(p: string) { return PRIORITIES.find((x) => x.value === p) ?? PRIORITIES[1]; }

const PAGE_SIZE = 20;

export default function TicketsPage() {
  const supabase = createClient();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editTicket, setEditTicket] = useState<Ticket | null>(null);
  const [saving, setSaving] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Ticket | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [formSubject, setFormSubject] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState('aberto');
  const [formPriority, setFormPriority] = useState('media');

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('tickets').select('*').order('created_at', { ascending: false });
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    const { data, error } = await query;
    if (error) { toast.error('Falha ao carregar tickets'); setLoading(false); return; }
    let filtered = (data ?? []) as unknown as Ticket[];
    if (search.trim()) {
      const term = search.toLowerCase();
      filtered = filtered.filter((t) => t.subject.toLowerCase().includes(term));
    }
    setTickets(filtered);
    setLoading(false);
  }, [supabase, statusFilter, search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTickets();
  }, [fetchTickets]);

  async function fetchComments(ticketId: string) {
    const { data } = await supabase
      .from('ticket_comments')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    setComments((data ?? []) as unknown as TicketComment[]);
  }

  function openAdd() {
    setEditTicket(null);
    setFormSubject('');
    setFormDescription('');
    setFormStatus('aberto');
    setFormPriority('media');
    setFormOpen(true);
  }

  function openEdit(ticket: Ticket) {
    setEditTicket(ticket);
    setFormSubject(ticket.subject);
    setFormDescription(ticket.description ?? '');
    setFormStatus(ticket.status);
    setFormPriority(ticket.priority);
    setFormOpen(true);
  }

  function openDetail(ticket: Ticket) {
    setSelectedTicket(ticket);
    setDetailOpen(true);
    fetchComments(ticket.id);
  }

  async function handleSave() {
    if (!formSubject.trim()) { toast.error('Assunto é obrigatório'); return; }
    setSaving(true);
    const payload = {
      subject: formSubject.trim(),
      description: formDescription.trim() || null,
      status: formStatus,
      priority: formPriority,
      resolved_at: formStatus === 'resolvido' ? new Date().toISOString() : null,
      closed_at: formStatus === 'fechado' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    if (editTicket) {
      const { error } = await supabase.from('tickets').update(payload).eq('id', editTicket.id);
      if (error) toast.error('Falha ao atualizar ticket');
      else { toast.success('Ticket atualizado'); setFormOpen(false); fetchTickets(); }
    } else {
      const { error } = await supabase.from('tickets').insert(payload);
      if (error) toast.error('Falha ao criar ticket');
      else { toast.success('Ticket criado'); setFormOpen(false); fetchTickets(); }
    }
    setSaving(false);
  }

  async function handleAddComment() {
    if (!newComment.trim() || !selectedTicket) return;
    setAddingComment(true);
    const { error } = await supabase.from('ticket_comments').insert({
      ticket_id: selectedTicket.id,
      content: newComment.trim(),
      is_internal: false,
    });
    if (error) toast.error('Falha ao adicionar comentário');
    else { setNewComment(''); fetchComments(selectedTicket.id); }
    setAddingComment(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('tickets').delete().eq('id', deleteTarget.id);
    if (error) toast.error('Falha ao excluir ticket');
    else { toast.success('Ticket excluído'); fetchTickets(); }
    setDeleting(false);
    setDeleteConfirmOpen(false);
  }

  const paged = tickets.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(tickets.length / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Desk — Suporte</h1>
          <p className="text-sm text-slate-400 mt-1">{tickets.length} solicitação(ões)</p>
        </div>
        <Button onClick={openAdd} className="bg-violet-600 hover:bg-violet-700 text-white">
          <Plus className="size-4" />Nova Solicitação
        </Button>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {STATUSES.map((s) => {
          const count = tickets.filter((t) => t.status === s.value).length;
          return (
            <button key={s.value}
              onClick={() => setStatusFilter(statusFilter === s.value ? 'all' : s.value)}
              className={`rounded-lg border p-2.5 text-left transition-colors ${statusFilter === s.value ? 'border-violet-500 bg-violet-500/10' : 'border-slate-800 bg-slate-900 hover:border-slate-700'}`}>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">{s.label}</p>
              <p className={`text-lg font-bold ${s.color.split(' ')[0]}`}>{count}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Buscar por assunto..." className="pl-8 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? 'all'); setPage(0); }}>
          <SelectTrigger className="w-48 bg-slate-900 border-slate-700 text-slate-300"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all" className="text-slate-300">Todos os status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s.value} value={s.value} className="text-slate-300">{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="text-slate-400">Assunto</TableHead>
              <TableHead className="text-slate-400">Status</TableHead>
              <TableHead className="text-slate-400 hidden sm:table-cell">Prioridade</TableHead>
              <TableHead className="text-slate-400 hidden lg:table-cell">Criado</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-slate-800">
                <TableCell colSpan={5} className="text-center py-12">
                  <Loader2 className="size-6 animate-spin text-violet-500 mx-auto" />
                </TableCell>
              </TableRow>
            ) : paged.length === 0 ? (
              <TableRow className="border-slate-800">
                <TableCell colSpan={5} className="text-center py-12">
                  <Headphones className="size-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-500">Nenhuma solicitação encontrada.</p>
                </TableCell>
              </TableRow>
            ) : paged.map((ticket) => {
              const statusInfo = getStatus(ticket.status);
              const priorityInfo = getPriority(ticket.priority);
              return (
                <TableRow key={ticket.id} className="border-slate-800 hover:bg-slate-900/50 cursor-pointer"
                  onClick={() => openDetail(ticket)}>
                  <TableCell className="text-white font-medium">{ticket.subject}</TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </TableCell>
                  <TableCell className={`hidden sm:table-cell text-sm font-medium ${priorityInfo.color}`}>
                    {priorityInfo.label}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-slate-500 text-xs">
                    {format(new Date(ticket.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm"
                        className="text-slate-400 hover:text-white" onClick={(e) => e.stopPropagation()} />}>
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(ticket); }}
                          className="text-slate-300 focus:bg-slate-800"><Pencil className="size-4" />Editar</DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-slate-700" />
                        <DropdownMenuItem variant="destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(ticket); setDeleteConfirmOpen(true); }}>
                          <Trash2 className="size-4" />Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">Página {page + 1} de {totalPages}</p>
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

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="bg-slate-900 border-slate-800 text-slate-200 flex flex-col w-full sm:max-w-lg">
          {selectedTicket && (
            <>
              <SheetHeader className="border-b border-slate-800 pb-4">
                <div className="flex items-start gap-3">
                  <div>
                    <SheetTitle className="text-white">{selectedTicket.subject}</SheetTitle>
                    <SheetDescription className="text-slate-500 mt-1">
                      Criado em {format(new Date(selectedTicket.created_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                    </SheetDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${getStatus(selectedTicket.status).color}`}>
                    {getStatus(selectedTicket.status).label}
                  </span>
                  <span className={`text-xs font-medium ${getPriority(selectedTicket.priority).color}`}>
                    {getPriority(selectedTicket.priority).label}
                  </span>
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto py-4 space-y-4">
                {selectedTicket.description && (
                  <div className="rounded-lg bg-slate-800 p-4">
                    <p className="text-sm text-slate-300">{selectedTicket.description}</p>
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
                    Comentários ({comments.length})
                  </h3>
                  <div className="space-y-3">
                    {comments.map((c) => (
                      <div key={c.id} className="rounded-lg bg-slate-800 p-3">
                        <p className="text-sm text-slate-300">{c.content}</p>
                        <p className="text-xs text-slate-600 mt-1">
                          {format(new Date(c.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    ))}
                    {comments.length === 0 && (
                      <p className="text-sm text-slate-600 text-center py-4">Nenhum comentário ainda.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4">
                <div className="flex gap-2">
                  <Textarea value={newComment} onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Adicionar comentário..." rows={2}
                    className="flex-1 bg-slate-800 border-slate-700 text-white resize-none text-sm" />
                  <Button onClick={handleAddComment} disabled={addingComment || !newComment.trim()}
                    className="bg-violet-600 hover:bg-violet-700 self-end">
                    {addingComment ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">{editTicket ? 'Editar Solicitação' : 'Nova Solicitação'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-slate-300">Assunto *</Label>
              <Input value={formSubject} onChange={(e) => setFormSubject(e.target.value)}
                placeholder="Descreva brevemente o problema" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300">Status</Label>
                <Select value={formStatus} onValueChange={(v) => setFormStatus(v ?? 'aberto')}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-300"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {STATUSES.map((s) => <SelectItem key={s.value} value={s.value} className="text-slate-300">{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">Prioridade</Label>
                <Select value={formPriority} onValueChange={(v) => setFormPriority(v ?? 'media')}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-300"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value} className="text-slate-300">{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Descrição</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Descreva o problema em detalhes..." rows={4}
                className="bg-slate-800 border-slate-700 text-white resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editTicket ? 'Salvar' : 'Criar Solicitação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Excluir Solicitação</DialogTitle>
            <DialogDescription className="text-slate-400">
              Tem certeza que deseja excluir <span className="text-slate-200 font-medium">"{deleteTarget?.subject}"</span>?
            </DialogDescription>
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
