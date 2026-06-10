'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, MoreHorizontal, Pencil, Trash2, Loader2, Calendar,
  Search, MapPin, Clock, CheckCircle, XCircle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { format, isToday, isThisWeek, isFuture } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CrmEvent {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  start_datetime: string;
  end_datetime?: string;
  location?: string;
  status: string;
  participants?: unknown[];
  contact_id?: string;
  lead_id?: string;
  deal_id?: string;
  created_at: string;
  updated_at: string;
}

const STATUSES = [
  { value: 'agendada', label: 'Agendada', color: 'text-blue-400 bg-blue-500/10', icon: Calendar },
  { value: 'realizada', label: 'Realizada', color: 'text-green-400 bg-green-500/10', icon: CheckCircle },
  { value: 'cancelada', label: 'Cancelada', color: 'text-red-400 bg-red-500/10', icon: XCircle },
];

function getStatusInfo(s: string) {
  return STATUSES.find((x) => x.value === s) ?? STATUSES[0];
}

export default function EventsPage() {
  const supabase = createClient();

  const [events, setEvents] = useState<CrmEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<CrmEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CrmEvent | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formStatus, setFormStatus] = useState('agendada');

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('crm_events')
      .select('*')
      .order('start_datetime', { ascending: false });
    if (error) { toast.error('Falha ao carregar reuniões'); setLoading(false); return; }
    setEvents((data ?? []) as unknown as CrmEvent[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEvents();
  }, [fetchEvents]);

  function openAdd() {
    setEditEvent(null);
    setFormTitle('');
    setFormDescription('');
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    setFormStart(now.toISOString().slice(0, 16));
    const end = new Date(now);
    end.setHours(end.getHours() + 1);
    setFormEnd(end.toISOString().slice(0, 16));
    setFormLocation('');
    setFormStatus('agendada');
    setFormOpen(true);
  }

  function openEdit(ev: CrmEvent) {
    setEditEvent(ev);
    setFormTitle(ev.title);
    setFormDescription(ev.description ?? '');
    setFormStart(ev.start_datetime.slice(0, 16));
    setFormEnd(ev.end_datetime?.slice(0, 16) ?? '');
    setFormLocation(ev.location ?? '');
    setFormStatus(ev.status);
    setFormOpen(true);
  }

  async function handleSave() {
    if (!formTitle.trim() || !formStart) { toast.error('Título e data/hora de início são obrigatórios'); return; }
    setSaving(true);
    const payload = {
      title: formTitle.trim(),
      description: formDescription.trim() || null,
      start_datetime: formStart,
      end_datetime: formEnd || null,
      location: formLocation.trim() || null,
      status: formStatus,
      updated_at: new Date().toISOString(),
    };
    if (editEvent) {
      const { error } = await supabase.from('crm_events').update(payload).eq('id', editEvent.id);
      if (error) toast.error('Falha ao atualizar reunião');
      else { toast.success('Reunião atualizada'); setFormOpen(false); fetchEvents(); }
    } else {
      const { error } = await supabase.from('crm_events').insert(payload);
      if (error) toast.error('Falha ao criar reunião');
      else { toast.success('Reunião criada'); setFormOpen(false); fetchEvents(); }
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('crm_events').delete().eq('id', deleteTarget.id);
    if (error) toast.error('Falha ao excluir reunião');
    else { toast.success('Reunião excluída'); fetchEvents(); }
    setDeleting(false);
    setDeleteConfirmOpen(false);
  }

  const filtered = events.filter((e) => {
    if (search.trim() && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'today') return isToday(new Date(e.start_datetime));
    if (filter === 'week') return isThisWeek(new Date(e.start_datetime));
    if (filter === 'upcoming') return isFuture(new Date(e.start_datetime));
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Reuniões</h1>
          <p className="text-sm text-slate-400 mt-1">{events.length} reunião(ões) cadastradas</p>
        </div>
        <Button onClick={openAdd} className="bg-violet-600 hover:bg-violet-700 text-white">
          <Plus className="size-4" />Nova Reunião
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar reuniões..." className="pl-8 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500" />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v ?? 'all')}>
          <TabsList className="bg-slate-800">
            <TabsTrigger value="all" className="data-[state=active]:bg-slate-700 text-xs">Todas</TabsTrigger>
            <TabsTrigger value="today" className="data-[state=active]:bg-slate-700 text-xs">Hoje</TabsTrigger>
            <TabsTrigger value="week" className="data-[state=active]:bg-slate-700 text-xs">Esta Semana</TabsTrigger>
            <TabsTrigger value="upcoming" className="data-[state=active]:bg-slate-700 text-xs">Próximas</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-violet-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-slate-800 py-16 text-center">
          <Calendar className="size-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500">Nenhuma reunião encontrada.</p>
          <Button variant="outline" size="sm" onClick={openAdd} className="mt-3 border-slate-700 text-slate-300 hover:bg-slate-800">
            <Plus className="size-3.5" />Agendar Reunião
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ev) => {
            const statusInfo = getStatusInfo(ev.status);
            const StatusIcon = statusInfo.icon;
            return (
              <div key={ev.id} className="rounded-lg border border-slate-800 bg-slate-900 p-4 hover:border-slate-700 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-lg shrink-0 ${statusInfo.color.split(' ')[1]}`}>
                    <StatusIcon className={`size-5 ${statusInfo.color.split(' ')[0]}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-white font-medium">{ev.title}</h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="text-slate-400 hover:text-white shrink-0" />}>
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                          <DropdownMenuItem onClick={() => openEdit(ev)} className="text-slate-300 focus:bg-slate-800"><Pencil className="size-4" />Editar</DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-slate-700" />
                          <DropdownMenuItem variant="destructive" onClick={() => { setDeleteTarget(ev); setDeleteConfirmOpen(true); }}>
                            <Trash2 className="size-4" />Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {ev.description && <p className="text-sm text-slate-400 mt-1 line-clamp-2">{ev.description}</p>}
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {format(new Date(ev.start_datetime), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                        {ev.end_datetime && ` – ${format(new Date(ev.end_datetime), 'HH:mm')}`}
                      </span>
                      {ev.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3" />{ev.location}
                        </span>
                      )}
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">{editEvent ? 'Editar Reunião' : 'Nova Reunião'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-slate-300">Título *</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Título da reunião" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Início *</Label>
              <Input type="datetime-local" value={formStart} onChange={(e) => setFormStart(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Fim</Label>
              <Input type="datetime-local" value={formEnd} onChange={(e) => setFormEnd(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Local</Label>
              <Input value={formLocation} onChange={(e) => setFormLocation(e.target.value)}
                placeholder="Endereço ou link" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Status</Label>
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v ?? 'agendada')}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-300"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {STATUSES.map((s) => <SelectItem key={s.value} value={s.value} className="text-slate-300">{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-slate-300">Descrição</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Pauta ou observações..." rows={3}
                className="bg-slate-800 border-slate-700 text-white resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editEvent ? 'Salvar' : 'Agendar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Excluir Reunião</DialogTitle>
            <DialogDescription className="text-slate-400">
              Tem certeza que deseja excluir <span className="text-slate-200 font-medium">"{deleteTarget?.title}"</span>?
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
