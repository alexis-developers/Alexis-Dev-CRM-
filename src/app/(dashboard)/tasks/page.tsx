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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Plus, MoreHorizontal, Pencil, Trash2, Loader2, CheckSquare,
  Clock, AlertCircle, CheckCheck, PauseCircle, Search,
} from 'lucide-react';
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CrmTask {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  due_date?: string;
  completed_at?: string;
  assigned_to?: string;
  contact_id?: string;
  lead_id?: string;
  deal_id?: string;
  created_at: string;
  updated_at: string;
}

const STATUSES = [
  { value: 'pendente', label: 'Pendente', icon: Clock, color: 'text-slate-400', bg: 'bg-slate-800' },
  { value: 'em_andamento', label: 'Em Andamento', icon: AlertCircle, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  { value: 'concluida', label: 'Concluída', icon: CheckCheck, color: 'text-green-400', bg: 'bg-green-500/10' },
  { value: 'deferida', label: 'Deferida', icon: PauseCircle, color: 'text-slate-500', bg: 'bg-slate-700/50' },
];

const PRIORITIES = [
  { value: 'baixa', label: 'Baixa', color: 'text-slate-400 bg-slate-700' },
  { value: 'media', label: 'Média', color: 'text-blue-400 bg-blue-500/10' },
  { value: 'alta', label: 'Alta', color: 'text-orange-400 bg-orange-500/10' },
  { value: 'urgente', label: 'Urgente', color: 'text-red-400 bg-red-500/10' },
];

function getPriorityStyle(p: string) {
  return PRIORITIES.find((x) => x.value === p)?.color ?? 'text-slate-400 bg-slate-700';
}
function getPriorityLabel(p: string) {
  return PRIORITIES.find((x) => x.value === p)?.label ?? p;
}

function getDueDateStyle(due?: string) {
  if (!due) return 'text-slate-500';
  const d = new Date(due);
  if (isPast(d)) return 'text-red-400';
  if (isToday(d)) return 'text-yellow-400';
  if (isTomorrow(d)) return 'text-blue-400';
  return 'text-slate-400';
}

function formatDueDate(due?: string) {
  if (!due) return null;
  const d = new Date(due);
  if (isToday(d)) return 'Hoje';
  if (isTomorrow(d)) return 'Amanhã';
  return format(d, "dd 'de' MMM", { locale: ptBR });
}

export default function TasksPage() {
  const supabase = createClient();

  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('kanban');

  const [formOpen, setFormOpen] = useState(false);
  const [editTask, setEditTask] = useState<CrmTask | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CrmTask | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState('pendente');
  const [formPriority, setFormPriority] = useState('media');
  const [formDueDate, setFormDueDate] = useState('');

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('crm_tasks')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { toast.error('Falha ao carregar tarefas'); setLoading(false); return; }
    setTasks((data ?? []) as unknown as CrmTask[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTasks();
  }, [fetchTasks]);

  function openAdd(defaultStatus = 'pendente') {
    setEditTask(null);
    setFormTitle('');
    setFormDescription('');
    setFormStatus(defaultStatus);
    setFormPriority('media');
    setFormDueDate('');
    setFormOpen(true);
  }

  function openEdit(task: CrmTask) {
    setEditTask(task);
    setFormTitle(task.title);
    setFormDescription(task.description ?? '');
    setFormStatus(task.status);
    setFormPriority(task.priority);
    setFormDueDate(task.due_date ? task.due_date.slice(0, 10) : '');
    setFormOpen(true);
  }

  async function handleSave() {
    if (!formTitle.trim()) { toast.error('Título é obrigatório'); return; }
    setSaving(true);

    const payload = {
      title: formTitle.trim(),
      description: formDescription.trim() || null,
      status: formStatus,
      priority: formPriority,
      due_date: formDueDate || null,
      completed_at: formStatus === 'concluida' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    if (editTask) {
      const { error } = await supabase.from('crm_tasks').update(payload).eq('id', editTask.id);
      if (error) toast.error('Falha ao atualizar tarefa');
      else { toast.success('Tarefa atualizada'); setFormOpen(false); fetchTasks(); }
    } else {
      const { error } = await supabase.from('crm_tasks').insert(payload);
      if (error) toast.error('Falha ao criar tarefa');
      else { toast.success('Tarefa criada'); setFormOpen(false); fetchTasks(); }
    }
    setSaving(false);
  }

  async function quickUpdateStatus(task: CrmTask, newStatus: string) {
    const { error } = await supabase.from('crm_tasks').update({
      status: newStatus,
      completed_at: newStatus === 'concluida' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', task.id);
    if (error) toast.error('Falha ao atualizar status');
    else fetchTasks();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('crm_tasks').delete().eq('id', deleteTarget.id);
    if (error) toast.error('Falha ao excluir tarefa');
    else { toast.success('Tarefa excluída'); fetchTasks(); }
    setDeleting(false);
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
  }

  const filtered = tasks.filter((t) =>
    !search.trim() || t.title.toLowerCase().includes(search.toLowerCase()),
  );

  const todayTasks = filtered.filter((t) => t.due_date && isToday(new Date(t.due_date)));
  const tomorrowTasks = filtered.filter((t) => t.due_date && isTomorrow(new Date(t.due_date)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Tarefas</h1>
          <p className="text-sm text-slate-400 mt-1">{tasks.length} tarefas no total</p>
        </div>
        <Button onClick={() => openAdd()} className="bg-violet-600 hover:bg-violet-700 text-white">
          <Plus className="size-4" />Nova Tarefa
        </Button>
      </div>

      {/* Search + View Toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tarefas..." className="pl-8 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500" />
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v ?? 'kanban')}>
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="kanban" className="data-[state=active]:bg-slate-700">Kanban</TabsTrigger>
            <TabsTrigger value="list" className="data-[state=active]:bg-slate-700">Lista</TabsTrigger>
            <TabsTrigger value="today" className="data-[state=active]:bg-slate-700">Hoje</TabsTrigger>
            <TabsTrigger value="tomorrow" className="data-[state=active]:bg-slate-700">Amanhã</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-violet-500" />
        </div>
      ) : (
        <>
          {/* Kanban View */}
          {view === 'kanban' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {STATUSES.map((col) => {
                const colTasks = filtered.filter((t) => t.status === col.value);
                const Icon = col.icon;
                return (
                  <div key={col.value} className="flex flex-col gap-3">
                    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${col.bg}`}>
                      <Icon className={`size-4 ${col.color}`} />
                      <span className={`text-sm font-medium ${col.color}`}>{col.label}</span>
                      <span className="ml-auto text-xs text-slate-500">{colTasks.length}</span>
                    </div>
                    <div className="flex flex-col gap-2 min-h-32">
                      {colTasks.map((task) => (
                        <div key={task.id}
                          className="rounded-lg border border-slate-800 bg-slate-900 p-3 hover:border-slate-700 transition-colors group">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm text-white font-medium leading-snug">{task.title}</p>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={<Button variant="ghost" size="icon-sm"
                                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white shrink-0" />}
                              >
                                <MoreHorizontal className="size-3.5" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                                <DropdownMenuItem onClick={() => openEdit(task)}
                                  className="text-slate-300 focus:bg-slate-800"><Pencil className="size-4" />Editar</DropdownMenuItem>
                                {STATUSES.filter((s) => s.value !== task.status).map((s) => (
                                  <DropdownMenuItem key={s.value} onClick={() => quickUpdateStatus(task, s.value)}
                                    className="text-slate-300 focus:bg-slate-800">
                                    <s.icon className="size-4" />Mover para {s.label}
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator className="bg-slate-700" />
                                <DropdownMenuItem variant="destructive"
                                  onClick={() => { setDeleteTarget(task); setDeleteConfirmOpen(true); }}>
                                  <Trash2 className="size-4" />Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          {task.description && (
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{task.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${getPriorityStyle(task.priority)}`}>
                              {getPriorityLabel(task.priority)}
                            </span>
                            {task.due_date && (
                              <span className={`text-[10px] ${getDueDateStyle(task.due_date)}`}>
                                {formatDueDate(task.due_date)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      <button onClick={() => openAdd(col.value)}
                        className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-700 px-3 py-2 text-xs text-slate-500 hover:border-slate-600 hover:text-slate-400 transition-colors">
                        <Plus className="size-3.5" />Adicionar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* List View */}
          {view === 'list' && (
            <div className="rounded-lg border border-slate-800 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400">Título</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400 hidden sm:table-cell">Prioridade</TableHead>
                    <TableHead className="text-slate-400 hidden md:table-cell">Prazo</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow className="border-slate-800">
                      <TableCell colSpan={5} className="text-center py-8 text-slate-500">Nenhuma tarefa encontrada.</TableCell>
                    </TableRow>
                  ) : filtered.map((task) => {
                    const statusInfo = STATUSES.find((s) => s.value === task.status);
                    const StatusIcon = statusInfo?.icon ?? Clock;
                    return (
                      <TableRow key={task.id} className="border-slate-800 hover:bg-slate-900/50">
                        <TableCell>
                          <div>
                            <p className="text-white font-medium">{task.title}</p>
                            {task.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{task.description}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`flex items-center gap-1.5 text-sm ${statusInfo?.color}`}>
                            <StatusIcon className="size-3.5" />{statusInfo?.label}
                          </span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${getPriorityStyle(task.priority)}`}>
                            {getPriorityLabel(task.priority)}
                          </span>
                        </TableCell>
                        <TableCell className={`hidden md:table-cell text-sm ${getDueDateStyle(task.due_date)}`}>
                          {formatDueDate(task.due_date) ?? <span className="text-slate-600">-</span>}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="text-slate-400 hover:text-white" />}>
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                              <DropdownMenuItem onClick={() => openEdit(task)} className="text-slate-300 focus:bg-slate-800"><Pencil className="size-4" />Editar</DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-slate-700" />
                              <DropdownMenuItem variant="destructive" onClick={() => { setDeleteTarget(task); setDeleteConfirmOpen(true); }}>
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
          )}

          {/* Today View */}
          {view === 'today' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">{todayTasks.length} {todayTasks.length === 1 ? 'tarefa' : 'tarefas'} para hoje</p>
              {todayTasks.length === 0 ? (
                <div className="rounded-lg border border-slate-800 py-12 text-center">
                  <CheckSquare className="size-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-500">Nenhuma tarefa para hoje.</p>
                </div>
              ) : todayTasks.map((task) => {
                const statusInfo = STATUSES.find((s) => s.value === task.status);
                const StatusIcon = statusInfo?.icon ?? Clock;
                return (
                  <div key={task.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
                    <StatusIcon className={`size-5 shrink-0 ${statusInfo?.color}`} />
                    <div className="flex-1">
                      <p className="text-white font-medium">{task.title}</p>
                      {task.description && <p className="text-sm text-slate-500">{task.description}</p>}
                    </div>
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${getPriorityStyle(task.priority)}`}>
                      {getPriorityLabel(task.priority)}
                    </span>
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(task)} className="text-slate-400 hover:text-white">
                      <Pencil className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tomorrow View */}
          {view === 'tomorrow' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">{tomorrowTasks.length} {tomorrowTasks.length === 1 ? 'tarefa' : 'tarefas'} para amanhã</p>
              {tomorrowTasks.length === 0 ? (
                <div className="rounded-lg border border-slate-800 py-12 text-center">
                  <CheckSquare className="size-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-500">Nenhuma tarefa para amanhã.</p>
                </div>
              ) : tomorrowTasks.map((task) => {
                const statusInfo = STATUSES.find((s) => s.value === task.status);
                const StatusIcon = statusInfo?.icon ?? Clock;
                return (
                  <div key={task.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
                    <StatusIcon className={`size-5 shrink-0 ${statusInfo?.color}`} />
                    <div className="flex-1">
                      <p className="text-white font-medium">{task.title}</p>
                      {task.description && <p className="text-sm text-slate-500">{task.description}</p>}
                    </div>
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${getPriorityStyle(task.priority)}`}>
                      {getPriorityLabel(task.priority)}
                    </span>
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(task)} className="text-slate-400 hover:text-white">
                      <Pencil className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">{editTask ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-slate-300">Título *</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Título da tarefa" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Status</Label>
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v ?? 'pendente')}>
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
            <div className="col-span-2 space-y-1.5">
              <Label className="text-slate-300">Prazo</Label>
              <Input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-slate-300">Descrição</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Descrição da tarefa..." rows={3}
                className="bg-slate-800 border-slate-700 text-white resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editTask ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Excluir Tarefa</DialogTitle>
            <DialogDescription className="text-slate-400">
              Tem certeza que deseja excluir <span className="text-slate-200 font-medium">"{deleteTarget?.title}"</span>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800">Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="size-4 animate-spin" />}Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
