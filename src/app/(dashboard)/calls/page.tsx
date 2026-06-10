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
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Plus, MoreHorizontal, Pencil, Trash2, Loader2, Phone,
  PhoneIncoming, PhoneOutgoing, PhoneMissed, Search,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CrmCall {
  id: string;
  user_id: string;
  direction: string;
  status: string;
  duration_minutes: number;
  call_datetime: string;
  notes?: string;
  contact_id?: string;
  lead_id?: string;
  deal_id?: string;
  created_at: string;
}

const CALL_STATUSES = [
  { value: 'conectado', label: 'Conectado', color: 'text-green-400 bg-green-500/10' },
  { value: 'nao_conectado', label: 'Não Conectado', color: 'text-slate-400 bg-slate-700' },
  { value: 'nao_atendeu', label: 'Não Atendeu', color: 'text-yellow-400 bg-yellow-500/10' },
  { value: 'ocupado', label: 'Ocupado', color: 'text-orange-400 bg-orange-500/10' },
  { value: 'mensagem_de_voz', label: 'Mensagem de Voz', color: 'text-blue-400 bg-blue-500/10' },
];

const DIRECTIONS = [
  { value: 'saida', label: 'Saída', icon: PhoneOutgoing },
  { value: 'entrada', label: 'Entrada', icon: PhoneIncoming },
];

function getStatusInfo(s: string) {
  return CALL_STATUSES.find((x) => x.value === s) ?? CALL_STATUSES[0];
}

export default function CallsPage() {
  const supabase = createClient();

  const [calls, setCalls] = useState<CrmCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editCall, setEditCall] = useState<CrmCall | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CrmCall | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [formDirection, setFormDirection] = useState('saida');
  const [formStatus, setFormStatus] = useState('conectado');
  const [formDuration, setFormDuration] = useState('');
  const [formDatetime, setFormDatetime] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('crm_calls')
      .select('*')
      .order('call_datetime', { ascending: false });
    if (error) { toast.error('Falha ao carregar chamadas'); setLoading(false); return; }
    setCalls((data ?? []) as unknown as CrmCall[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCalls();
  }, [fetchCalls]);

  function openAdd() {
    setEditCall(null);
    setFormDirection('saida');
    setFormStatus('conectado');
    setFormDuration('');
    setFormDatetime(new Date().toISOString().slice(0, 16));
    setFormNotes('');
    setFormOpen(true);
  }

  function openEdit(call: CrmCall) {
    setEditCall(call);
    setFormDirection(call.direction);
    setFormStatus(call.status);
    setFormDuration(String(call.duration_minutes ?? ''));
    setFormDatetime(call.call_datetime.slice(0, 16));
    setFormNotes(call.notes ?? '');
    setFormOpen(true);
  }

  async function handleSave() {
    if (!formDatetime) { toast.error('Data/hora é obrigatória'); return; }
    setSaving(true);
    const payload = {
      direction: formDirection,
      status: formStatus,
      duration_minutes: formDuration ? parseFloat(formDuration) : 0,
      call_datetime: formDatetime,
      notes: formNotes.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (editCall) {
      const { error } = await supabase.from('crm_calls').update(payload).eq('id', editCall.id);
      if (error) toast.error('Falha ao atualizar chamada');
      else { toast.success('Chamada atualizada'); setFormOpen(false); fetchCalls(); }
    } else {
      const { error } = await supabase.from('crm_calls').insert(payload);
      if (error) toast.error('Falha ao registrar chamada');
      else { toast.success('Chamada registrada'); setFormOpen(false); fetchCalls(); }
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('crm_calls').delete().eq('id', deleteTarget.id);
    if (error) toast.error('Falha ao excluir chamada');
    else { toast.success('Chamada excluída'); fetchCalls(); }
    setDeleting(false);
    setDeleteConfirmOpen(false);
  }

  const filtered = calls.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (search.trim() && !c.notes?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalCalls = calls.length;
  const connected = calls.filter((c) => c.status === 'conectado').length;
  const totalMinutes = calls.reduce((sum, c) => sum + (c.duration_minutes ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Chamadas</h1>
          <p className="text-sm text-slate-400 mt-1">Histórico de chamadas e ligações</p>
        </div>
        <Button onClick={openAdd} className="bg-violet-600 hover:bg-violet-700 text-white">
          <Plus className="size-4" />Registrar Chamada
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
          <p className="text-xs text-slate-500">Total de Chamadas</p>
          <p className="text-2xl font-bold text-white">{totalCalls}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
          <p className="text-xs text-slate-500">Conectadas</p>
          <p className="text-2xl font-bold text-green-400">{connected}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
          <p className="text-xs text-slate-500">Minutos Totais</p>
          <p className="text-2xl font-bold text-white">{totalMinutes.toFixed(0)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por notas..." className="pl-8 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? 'all')}>
          <SelectTrigger className="w-44 bg-slate-900 border-slate-700 text-slate-300"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all" className="text-slate-300">Todos os resultados</SelectItem>
            {CALL_STATUSES.map((s) => <SelectItem key={s.value} value={s.value} className="text-slate-300">{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="text-slate-400">Data/Hora</TableHead>
              <TableHead className="text-slate-400">Direção</TableHead>
              <TableHead className="text-slate-400">Resultado</TableHead>
              <TableHead className="text-slate-400 hidden sm:table-cell">Duração</TableHead>
              <TableHead className="text-slate-400 hidden md:table-cell">Notas</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-slate-800">
                <TableCell colSpan={6} className="text-center py-12">
                  <Loader2 className="size-6 animate-spin text-violet-500 mx-auto" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow className="border-slate-800">
                <TableCell colSpan={6} className="text-center py-12">
                  <Phone className="size-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-500">Nenhuma chamada registrada.</p>
                </TableCell>
              </TableRow>
            ) : filtered.map((call) => {
              const statusInfo = getStatusInfo(call.status);
              const dirInfo = DIRECTIONS.find((d) => d.value === call.direction) ?? DIRECTIONS[0];
              const DirIcon = dirInfo.icon;
              return (
                <TableRow key={call.id} className="border-slate-800 hover:bg-slate-900/50">
                  <TableCell className="text-white text-sm">
                    {format(new Date(call.call_datetime), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <span className={`flex items-center gap-1.5 text-sm ${call.direction === 'entrada' ? 'text-blue-400' : 'text-slate-400'}`}>
                      <DirIcon className="size-3.5" />{dirInfo.label}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-slate-400 text-sm">
                    {call.duration_minutes ? `${call.duration_minutes} min` : <span className="text-slate-600">-</span>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-slate-400 text-sm max-w-xs">
                    <span className="line-clamp-1">{call.notes ?? <span className="text-slate-600">-</span>}</span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="text-slate-400 hover:text-white" />}>
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                        <DropdownMenuItem onClick={() => openEdit(call)} className="text-slate-300 focus:bg-slate-800"><Pencil className="size-4" />Editar</DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-slate-700" />
                        <DropdownMenuItem variant="destructive" onClick={() => { setDeleteTarget(call); setDeleteConfirmOpen(true); }}>
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

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">{editCall ? 'Editar Chamada' : 'Registrar Chamada'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-slate-300">Data e Hora *</Label>
              <Input type="datetime-local" value={formDatetime} onChange={(e) => setFormDatetime(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Direção</Label>
              <Select value={formDirection} onValueChange={(v) => setFormDirection(v ?? 'saida')}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-300"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {DIRECTIONS.map((d) => <SelectItem key={d.value} value={d.value} className="text-slate-300">{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Resultado</Label>
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v ?? 'conectado')}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-300"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {CALL_STATUSES.map((s) => <SelectItem key={s.value} value={s.value} className="text-slate-300">{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-slate-300">Duração (minutos)</Label>
              <Input type="number" min="0" step="0.5" value={formDuration} onChange={(e) => setFormDuration(e.target.value)}
                placeholder="Ex: 5.5" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-slate-300">Notas</Label>
              <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Resumo da chamada..." rows={3}
                className="bg-slate-800 border-slate-700 text-white resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editCall ? 'Salvar' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Excluir Chamada</DialogTitle>
            <DialogDescription className="text-slate-400">Tem certeza que deseja excluir este registro de chamada?</DialogDescription>
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
