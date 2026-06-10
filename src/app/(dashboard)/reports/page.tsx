'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, BarChart2, TrendingUp, Users, UserPlus, CheckSquare, Phone, Headphones } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Stats {
  totalContacts: number;
  totalLeads: number;
  totalLeadsConvertidos: number;
  totalTasks: number;
  totalTasksDone: number;
  totalCalls: number;
  totalCallsConnected: number;
  totalTickets: number;
  totalTicketsOpen: number;
  totalDeals: number;
  dealsByStatus: Record<string, number>;
  leadsThisMonth: number;
  contactsThisMonth: number;
  callsThisWeek: number;
  tasksOverdue: number;
}

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
  trend?: string;
}

function MetricCard({ label, value, sub, icon: Icon, color, trend }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${color}`}>
          <Icon className="size-5" />
        </div>
      </div>
      {trend && <p className="text-xs text-green-400 mt-3">{trend}</p>}
    </div>
  );
}

export default function ReportsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [leadsBySource, setLeadsBySource] = useState<Record<string, number>>({});
  const [tasksByStatus, setTasksByStatus] = useState<Record<string, number>>({});
  const [ticketsByStatus, setTicketsByStatus] = useState<Record<string, number>>({});
  const [ticketsByPriority, setTicketsByPriority] = useState<Record<string, number>>({});

  const fetchStats = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const monthStart = startOfMonth(now).toISOString();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();

    const [
      { data: contacts },
      { data: leads },
      { data: tasks },
      { data: calls },
      { data: tickets },
      { data: deals },
    ] = await Promise.all([
      supabase.from('contacts').select('*'),
      supabase.from('leads').select('*'),
      supabase.from('crm_tasks').select('*'),
      supabase.from('crm_calls').select('*'),
      supabase.from('tickets').select('*'),
      supabase.from('deals').select('*'),
    ]);

    type R = Record<string, string | number | null | undefined>;
    const c = (contacts ?? []) as R[];
    const l = (leads ?? []) as R[];
    const t = (tasks ?? []) as R[];
    const ca = (calls ?? []) as R[];
    const tk = (tickets ?? []) as R[];
    const d = (deals ?? []) as R[];

    const leadsSourceMap: Record<string, number> = {};
    l.forEach((lead) => {
      const src = String(lead.source ?? 'Sem fonte');
      leadsSourceMap[src] = (leadsSourceMap[src] ?? 0) + 1;
    });
    setLeadsBySource(leadsSourceMap);

    const taskStatusMap: Record<string, number> = {};
    t.forEach((task) => {
      const s = String(task.status ?? '');
      taskStatusMap[s] = (taskStatusMap[s] ?? 0) + 1;
    });
    setTasksByStatus(taskStatusMap);

    const ticketStatusMap: Record<string, number> = {};
    const ticketPriorityMap: Record<string, number> = {};
    tk.forEach((ticket) => {
      const s = String(ticket.status ?? '');
      const p = String(ticket.priority ?? '');
      ticketStatusMap[s] = (ticketStatusMap[s] ?? 0) + 1;
      ticketPriorityMap[p] = (ticketPriorityMap[p] ?? 0) + 1;
    });
    setTicketsByStatus(ticketStatusMap);
    setTicketsByPriority(ticketPriorityMap);

    const dealStatusMap: Record<string, number> = {};
    d.forEach((deal) => {
      const s = String(deal.status ?? 'open');
      dealStatusMap[s] = (dealStatusMap[s] ?? 0) + 1;
    });

    const now_iso = now.toISOString();
    const tasksOverdue = t.filter((task) =>
      task.due_date && String(task.due_date) < now_iso && task.status !== 'concluida',
    ).length;

    setStats({
      totalContacts: c.length,
      totalLeads: l.length,
      totalLeadsConvertidos: l.filter((lead) => lead.status === 'convertido').length,
      totalTasks: t.length,
      totalTasksDone: t.filter((task) => task.status === 'concluida').length,
      totalCalls: ca.length,
      totalCallsConnected: ca.filter((call) => call.status === 'conectado').length,
      totalTickets: tk.length,
      totalTicketsOpen: tk.filter((ticket) => ticket.status === 'aberto').length,
      totalDeals: d.length,
      dealsByStatus: dealStatusMap,
      leadsThisMonth: l.filter((lead) => lead.created_at && String(lead.created_at) >= monthStart).length,
      contactsThisMonth: c.filter((contact) => contact.created_at && String(contact.created_at) >= monthStart).length,
      callsThisWeek: ca.filter((call) => call.call_datetime && String(call.call_datetime) >= weekStart).length,
      tasksOverdue,
    });

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!stats) return null;

  const conversionRate = stats.totalLeads > 0
    ? Math.round((stats.totalLeadsConvertidos / stats.totalLeads) * 100)
    : 0;

  const taskCompletionRate = stats.totalTasks > 0
    ? Math.round((stats.totalTasksDone / stats.totalTasks) * 100)
    : 0;

  const callConnectionRate = stats.totalCalls > 0
    ? Math.round((stats.totalCallsConnected / stats.totalCalls) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Estatísticas</h1>
        <p className="text-sm text-slate-400 mt-1">
          Visão geral do desempenho — {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* Main metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Clientes"
          value={stats.totalContacts}
          sub={`+${stats.contactsThisMonth} este mês`}
          icon={Users}
          color="bg-blue-500/10 text-blue-400"
        />
        <MetricCard
          label="Pré-Vendas"
          value={stats.totalLeads}
          sub={`${conversionRate}% taxa de conversão`}
          icon={UserPlus}
          color="bg-violet-500/10 text-violet-400"
          trend={`+${stats.leadsThisMonth} novos este mês`}
        />
        <MetricCard
          label="Tarefas"
          value={stats.totalTasks}
          sub={`${taskCompletionRate}% concluídas`}
          icon={CheckSquare}
          color="bg-green-500/10 text-green-400"
        />
        <MetricCard
          label="Chamadas"
          value={stats.totalCalls}
          sub={`${callConnectionRate}% conectadas`}
          icon={Phone}
          color="bg-orange-500/10 text-orange-400"
          trend={`${stats.callsThisWeek} esta semana`}
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Conversão de Leads</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.totalLeadsConvertidos}</p>
          <p className="text-xs text-slate-500 mt-1">de {stats.totalLeads} leads</p>
          <div className="mt-3 bg-slate-800 rounded-full h-1.5">
            <div className="bg-violet-500 h-1.5 rounded-full transition-all" style={{ width: `${conversionRate}%` }} />
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Tarefas em Atraso</p>
          <p className={`text-2xl font-bold mt-1 ${stats.tasksOverdue > 0 ? 'text-red-400' : 'text-white'}`}>
            {stats.tasksOverdue}
          </p>
          <p className="text-xs text-slate-500 mt-1">{stats.totalTasksDone} concluídas</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Tickets Abertos</p>
          <p className={`text-2xl font-bold mt-1 ${stats.totalTicketsOpen > 0 ? 'text-yellow-400' : 'text-white'}`}>
            {stats.totalTicketsOpen}
          </p>
          <p className="text-xs text-slate-500 mt-1">de {stats.totalTickets} total</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Negócios</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.totalDeals}</p>
          <p className="text-xs text-slate-500 mt-1">{stats.dealsByStatus['open'] ?? 0} em aberto</p>
        </div>
      </div>

      {/* Detailed breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads by source */}
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Leads por Fonte</h3>
          {Object.keys(leadsBySource).length === 0 ? (
            <p className="text-slate-500 text-sm">Nenhum dado disponível.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(leadsBySource)
                .sort(([, a], [, b]) => b - a)
                .map(([source, count]) => {
                  const pct = Math.round((count / stats.totalLeads) * 100);
                  return (
                    <div key={source}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-300">{source}</span>
                        <span className="text-slate-500">{count} ({pct}%)</span>
                      </div>
                      <div className="bg-slate-800 rounded-full h-1.5">
                        <div className="bg-violet-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Tasks by status */}
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Tarefas por Status</h3>
          {Object.keys(tasksByStatus).length === 0 ? (
            <p className="text-slate-500 text-sm">Nenhum dado disponível.</p>
          ) : (
            <div className="space-y-3">
              {[
                { key: 'pendente', label: 'Pendente', color: 'bg-slate-500' },
                { key: 'em_andamento', label: 'Em Andamento', color: 'bg-yellow-500' },
                { key: 'concluida', label: 'Concluída', color: 'bg-green-500' },
                { key: 'deferida', label: 'Deferida', color: 'bg-slate-600' },
              ].map(({ key, label, color }) => {
                const count = tasksByStatus[key] ?? 0;
                const pct = stats.totalTasks > 0 ? Math.round((count / stats.totalTasks) * 100) : 0;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-300">{label}</span>
                      <span className="text-slate-500">{count} ({pct}%)</span>
                    </div>
                    <div className="bg-slate-800 rounded-full h-1.5">
                      <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tickets by status */}
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Tickets por Status</h3>
          {Object.keys(ticketsByStatus).length === 0 ? (
            <p className="text-slate-500 text-sm">Nenhum dado disponível.</p>
          ) : (
            <div className="space-y-3">
              {[
                { key: 'aberto', label: 'Aberto', color: 'bg-blue-500' },
                { key: 'em_andamento', label: 'Em Andamento', color: 'bg-yellow-500' },
                { key: 'aguardando_cliente', label: 'Aguardando Cliente', color: 'bg-orange-500' },
                { key: 'resolvido', label: 'Resolvido', color: 'bg-green-500' },
                { key: 'fechado', label: 'Fechado', color: 'bg-slate-600' },
                { key: 'escalado', label: 'Escalado', color: 'bg-red-500' },
              ].map(({ key, label, color }) => {
                const count = ticketsByStatus[key] ?? 0;
                if (!count) return null;
                const pct = stats.totalTickets > 0 ? Math.round((count / stats.totalTickets) * 100) : 0;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-300">{label}</span>
                      <span className="text-slate-500">{count} ({pct}%)</span>
                    </div>
                    <div className="bg-slate-800 rounded-full h-1.5">
                      <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tickets by priority */}
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Tickets por Prioridade</h3>
          {Object.keys(ticketsByPriority).length === 0 ? (
            <p className="text-slate-500 text-sm">Nenhum dado disponível.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'baixa', label: 'Baixa', color: 'text-slate-400' },
                { key: 'media', label: 'Média', color: 'text-blue-400' },
                { key: 'alta', label: 'Alta', color: 'text-orange-400' },
                { key: 'urgente', label: 'Urgente', color: 'text-red-400' },
              ].map(({ key, label, color }) => (
                <div key={key} className="rounded-lg bg-slate-800 p-3">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className={`text-2xl font-bold ${color}`}>{ticketsByPriority[key] ?? 0}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
