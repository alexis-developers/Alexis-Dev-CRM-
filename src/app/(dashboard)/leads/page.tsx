'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Search, Plus, MoreHorizontal, Pencil, Trash2, Loader2, UserPlus,
  ChevronLeft, ChevronRight, UserCheck, Phone, Mail, Building2,
} from 'lucide-react';

interface Lead {
  id: string;
  user_id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  source?: string;
  status: string;
  owner_id?: string;
  description?: string;
  converted_to_contact_id?: string;
  converted_at?: string;
  created_at: string;
  updated_at: string;
}

const STATUS_OPTIONS = [
  { value: 'novo', label: 'Novo', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'em_contato', label: 'Em Contato', color: 'bg-yellow-500/20 text-yellow-400' },
  { value: 'qualificado', label: 'Qualificado', color: 'bg-green-500/20 text-green-400' },
  { value: 'nao_qualificado', label: 'Não Qualificado', color: 'bg-red-500/20 text-red-400' },
  { value: 'convertido', label: 'Convertido', color: 'bg-purple-500/20 text-purple-400' },
];

const SOURCE_OPTIONS = [
  'Website', 'Redes Sociais', 'Indicação', 'Ligação', 'Email', 'Evento', 'Anúncio', 'Outro',
];

const PAGE_SIZE = 25;

function getStatusStyle(status: string) {
  return STATUS_OPTIONS.find((s) => s.value === status)?.color ?? 'bg-slate-500/20 text-slate-400';
}
function getStatusLabel(status: string) {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status;
}

export default function LeadsPage() {
  const supabase = createClient();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [convertOpen, setConvertOpen] = useState(false);
  const [convertTarget, setConvertTarget] = useState<Lead | null>(null);
  const [converting, setConverting] = useState(false);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formSource, setFormSource] = useState('');
  const [formStatus, setFormStatus] = useState('novo');
  const [formDescription, setFormDescription] = useState('');

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      toast.error('Falha ao carregar pré-vendas');
      setLoading(false);
      return;
    }

    let filtered = (data ?? []) as unknown as Lead[];
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.name?.toLowerCase().includes(term) ||
          l.email?.toLowerCase().includes(term) ||
          l.phone?.toLowerCase().includes(term) ||
          l.company?.toLowerCase().includes(term),
      );
    }

    setLeads(filtered);
    setTotalCount(filtered.length < PAGE_SIZE ? from + filtered.length : from + PAGE_SIZE + 1);
    setLoading(false);
  }, [supabase, page, search, statusFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLeads();
  }, [fetchLeads]);

  function openAdd() {
    setEditLead(null);
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormCompany('');
    setFormSource('');
    setFormStatus('novo');
    setFormDescription('');
    setFormOpen(true);
  }

  function openEdit(lead: Lead) {
    setEditLead(lead);
    setFormName(lead.name);
    setFormEmail(lead.email ?? '');
    setFormPhone(lead.phone ?? '');
    setFormCompany(lead.company ?? '');
    setFormSource(lead.source ?? '');
    setFormStatus(lead.status);
    setFormDescription(lead.description ?? '');
    setFormOpen(true);
  }

  async function handleSave() {
    if (!formName.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    setSaving(true);

    const payload = {
      name: formName.trim(),
      email: formEmail.trim() || null,
      phone: formPhone.trim() || null,
      company: formCompany.trim() || null,
      source: formSource || null,
      status: formStatus,
      description: formDescription.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (editLead) {
      const { error } = await supabase.from('leads').update(payload).eq('id', editLead.id);
      if (error) toast.error('Falha ao atualizar pré-venda');
      else { toast.success('Pré-venda atualizada'); setFormOpen(false); fetchLeads(); }
    } else {
      const { error } = await supabase.from('leads').insert(payload);
      if (error) toast.error('Falha ao criar pré-venda');
      else { toast.success('Pré-venda criada'); setFormOpen(false); fetchLeads(); }
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('leads').delete().eq('id', deleteTarget.id);
    if (error) toast.error('Falha ao excluir pré-venda');
    else { toast.success('Pré-venda excluída'); fetchLeads(); }
    setDeleting(false);
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
  }

  async function handleConvert() {
    if (!convertTarget) return;
    setConverting(true);

    const { data: contact, error } = await supabase.from('contacts').insert({
      name: convertTarget.name,
      email: convertTarget.email ?? null,
      phone: convertTarget.phone ?? null,
      company: convertTarget.company ?? null,
      source: convertTarget.source ?? null,
      description: convertTarget.description ?? null,
    });

    if (error) {
      toast.error('Falha ao converter pré-venda em cliente');
      setConverting(false);
      return;
    }

    await supabase.from('leads').update({
      status: 'convertido',
      converted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', convertTarget.id);

    toast.success(`"${convertTarget.name}" convertido em cliente com sucesso`);
    setConverting(false);
    setConvertOpen(false);
    setConvertTarget(null);
    fetchLeads();
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasNext = page < totalPages - 1;
  const hasPrev = page > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Pré-Vendas</h1>
          <p className="text-sm text-slate-400 mt-1">
            Gerencie seus leads e oportunidades de venda. {totalCount > 0 && `${totalCount} registros.`}
          </p>
        </div>
        <Button onClick={openAdd} className="bg-violet-600 hover:bg-violet-700 text-white">
          <Plus className="size-4" />
          Novo Lead
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Buscar por nome, email, telefone..."
            className="pl-8 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? 'all'); setPage(0); }}>
          <SelectTrigger className="w-44 bg-slate-900 border-slate-700 text-slate-300">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all" className="text-slate-300">Todos os status</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value} className="text-slate-300">{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {STATUS_OPTIONS.map((s) => {
          const count = leads.filter((l) => l.status === s.value).length;
          return (
            <button
              key={s.value}
              onClick={() => setStatusFilter(statusFilter === s.value ? 'all' : s.value)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                statusFilter === s.value ? 'border-violet-500 bg-violet-500/10' : 'border-slate-800 bg-slate-900 hover:border-slate-700'
              }`}
            >
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="text-xl font-bold text-white">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="text-slate-400">Nome</TableHead>
              <TableHead className="text-slate-400 hidden md:table-cell">Empresa</TableHead>
              <TableHead className="text-slate-400 hidden sm:table-cell">Contato</TableHead>
              <TableHead className="text-slate-400">Status</TableHead>
              <TableHead className="text-slate-400 hidden lg:table-cell">Fonte</TableHead>
              <TableHead className="text-slate-400 hidden lg:table-cell">Criado</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-slate-800">
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-6 animate-spin text-violet-500" />
                    <p className="text-sm text-slate-500">Carregando leads...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : leads.length === 0 ? (
              <TableRow className="border-slate-800">
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <UserPlus className="size-8 text-slate-600" />
                    <p className="text-sm text-slate-500">Nenhum lead encontrado.</p>
                    <Button variant="outline" size="sm" onClick={openAdd}
                      className="mt-2 border-slate-700 text-slate-300 hover:bg-slate-800">
                      <Plus className="size-3.5" />
                      Adicionar primeiro lead
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => (
                <TableRow key={lead.id} className="border-slate-800 hover:bg-slate-900/50">
                  <TableCell>
                    <div>
                      <p className="text-white font-medium">{lead.name}</p>
                      {lead.email && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Mail className="size-3" />{lead.email}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-slate-400 text-sm">
                    {lead.company ? (
                      <span className="flex items-center gap-1"><Building2 className="size-3" />{lead.company}</span>
                    ) : <span className="text-slate-600">-</span>}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-slate-400 text-sm">
                    {lead.phone ? (
                      <span className="flex items-center gap-1 font-mono text-xs"><Phone className="size-3" />{lead.phone}</span>
                    ) : <span className="text-slate-600">-</span>}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusStyle(lead.status)}`}>
                      {getStatusLabel(lead.status)}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-slate-400 text-sm">
                    {lead.source ?? <span className="text-slate-600">-</span>}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-slate-500 text-xs">
                    {new Date(lead.created_at).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon-sm" className="text-slate-400 hover:text-white" />
                        }
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                        <DropdownMenuItem
                          onClick={() => openEdit(lead)}
                          className="text-slate-300 focus:bg-slate-800 focus:text-white"
                        >
                          <Pencil className="size-4" />Editar
                        </DropdownMenuItem>
                        {lead.status !== 'convertido' && (
                          <DropdownMenuItem
                            onClick={() => { setConvertTarget(lead); setConvertOpen(true); }}
                            className="text-slate-300 focus:bg-slate-800 focus:text-white"
                          >
                            <UserCheck className="size-4" />Converter em Cliente
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator className="bg-slate-700" />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => { setDeleteTarget(lead); setDeleteConfirmOpen(true); }}
                        >
                          <Trash2 className="size-4" />Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Página {page + 1} de {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" disabled={!hasPrev} onClick={() => setPage((p) => p - 1)}
              className="border-slate-700 text-slate-400 hover:bg-slate-800 disabled:opacity-30">
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="icon-sm" disabled={!hasNext} onClick={() => setPage((p) => p + 1)}
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
            <DialogTitle className="text-white">{editLead ? 'Editar Lead' : 'Novo Lead'}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {editLead ? 'Atualize as informações do lead.' : 'Cadastre um novo lead de pré-venda.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-slate-300">Nome *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)}
                placeholder="Nome do lead" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Email</Label>
              <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)}
                placeholder="email@exemplo.com" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Telefone</Label>
              <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)}
                placeholder="+55 11 99999-9999" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Empresa</Label>
              <Input value={formCompany} onChange={(e) => setFormCompany(e.target.value)}
                placeholder="Nome da empresa" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Fonte</Label>
              <Select value={formSource} onValueChange={(v) => setFormSource(v ?? '')}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-300">
                  <SelectValue placeholder="Selecionar fonte" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {SOURCE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="text-slate-300">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-slate-300">Status</Label>
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v ?? 'novo')}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="text-slate-300">{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-slate-300">Descrição</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Observações sobre o lead..." rows={3}
                className="bg-slate-800 border-slate-700 text-white resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800">
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editLead ? 'Salvar' : 'Criar Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert Dialog */}
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Converter em Cliente</DialogTitle>
            <DialogDescription className="text-slate-400">
              Isso criará um novo cliente com os dados de{' '}
              <span className="text-slate-200 font-medium">{convertTarget?.name}</span> e marcará este lead como convertido.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800">
              Cancelar
            </Button>
            <Button onClick={handleConvert} disabled={converting} className="bg-green-600 hover:bg-green-700">
              {converting && <Loader2 className="size-4 animate-spin" />}
              <UserCheck className="size-4" />
              Converter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Excluir Lead</DialogTitle>
            <DialogDescription className="text-slate-400">
              Tem certeza que deseja excluir{' '}
              <span className="text-slate-200 font-medium">{deleteTarget?.name}</span>?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
