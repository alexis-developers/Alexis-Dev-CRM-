'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Users,
  UserPlus,
  Trash2,
  Edit2,
  Shield,
  Check,
  X,
  Search,
  Lock,
  Loader2,
  CheckCheck,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface UserPermission {
  module_name: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  is_super_admin: boolean;
  must_change_password: boolean;
  ativo: boolean;
  user_permissions: UserPermission[];
}

const MODULES = [
  { key: 'inbox', label: 'Caixa de Entrada', desc: 'Acesso ao chat em tempo real e atendimento WhatsApp.' },
  { key: 'contacts', label: 'Contatos', desc: 'Gestão de contatos, campos personalizados e tags.' },
  { key: 'pipelines', label: 'Funil de Captação', desc: 'Gestão de negócios, etapas e oportunidades.' },
  { key: 'broadcasts', label: 'Transmissões', desc: 'Envio de mensagens em massa para audiências.' },
  { key: 'automations', label: 'Automações', desc: 'Configuração de fluxos automáticos e gatilhos.' },
  { key: 'feeds', label: 'Timeline Social', desc: 'Visualização e interação no feed interno da equipe.' },
];

export default function UsersPage() {
  const { profile: callerProfile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  // Dialog State
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [permMatrix, setPermMatrix] = useState<Record<string, Record<string, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users || []);
      } else {
        toast.error(data.error || 'Falha ao carregar usuários.');
      }
    } catch (err) {
      console.error('Error loading users:', err);
      toast.error('Ocorreu um erro ao carregar os usuários.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setEditingUserId(null);
    setName('');
    setEmail('');
    // Auto-generate a strong provisional password
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let autoPass = '';
    for (let i = 0; i < 10; i++) autoPass += chars.charAt(Math.floor(Math.random() * chars.length));
    setPassword(autoPass + 'Aa1!');
    setAtivo(true);
    
    // Initialize matrix with false
    const initialMatrix: Record<string, Record<string, boolean>> = {};
    MODULES.forEach((m) => {
      initialMatrix[m.key] = { can_view: false, can_create: false, can_edit: false, can_delete: false };
    });
    setPermMatrix(initialMatrix);
    setModalOpen(true);
  };

  const handleOpenEditModal = (targetUser: Profile) => {
    setIsEditing(true);
    setEditingUserId(targetUser.id);
    setName(targetUser.full_name);
    setEmail(targetUser.email);
    setPassword('');
    setAtivo(targetUser.ativo);

    const initialMatrix: Record<string, Record<string, boolean>> = {};
    MODULES.forEach((m) => {
      const activePerm = targetUser.user_permissions.find((p) => p.module_name === m.key);
      initialMatrix[m.key] = {
        can_view: activePerm?.can_view || false,
        can_create: activePerm?.can_create || false,
        can_edit: activePerm?.can_edit || false,
        can_delete: activePerm?.can_delete || false,
      };
    });
    setPermMatrix(initialMatrix);
    setModalOpen(true);
  };

  const handleToggleMatrix = (moduleKey: string, permKey: string, val: boolean) => {
    setPermMatrix((prev) => {
      const updatedModule = { ...prev[moduleKey] };
      updatedModule[permKey] = val;
      
      // If setting create/edit/delete to true, view must be true as well
      if (val && permKey !== 'can_view') {
        updatedModule['can_view'] = true;
      }
      // If setting view to false, others must be false as well
      if (!val && permKey === 'can_view') {
        updatedModule['can_create'] = false;
        updatedModule['can_edit'] = false;
        updatedModule['can_delete'] = false;
      }

      return { ...prev, [moduleKey]: updatedModule };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Nome é obrigatório.');
    if (!isEditing && (!email.trim() || !password.trim())) {
      return toast.error('Email e Senha são obrigatórios para novos usuários.');
    }

    setSubmitting(true);
    try {
      const endpoint = '/api/admin/users';
      const method = isEditing ? 'PUT' : 'POST';
      const payload = isEditing
        ? { id: editingUserId, full_name: name, ativo, permissions: permMatrix }
        : { name, email, password, permissions: permMatrix };

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(isEditing ? 'Usuário atualizado com sucesso!' : 'Usuário convidado com sucesso!');
        setModalOpen(false);
        loadUsers();
      } else {
        toast.error(data.error || 'Erro ao salvar alterações.');
      }
    } catch (err) {
      toast.error('Erro ao realizar comunicação com o servidor.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (targetUser: Profile) => {
    if (targetUser.is_super_admin) {
      return toast.error('Não é possível excluir o Super Admin principal.');
    }

    if (!confirm(`Deseja realmente remover o acesso de ${targetUser.full_name} permanentemente?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users?id=${targetUser.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        toast.success('Acesso excluído com sucesso.');
        loadUsers();
      } else {
        toast.error(data.error || 'Falha ao deletar usuário.');
      }
    } catch (err) {
      toast.error('Erro ao deletar usuário.');
    }
  };

  // Filter list
  const filteredUsers = users.filter((u) => {
    const text = busca.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(text) ||
      u.email?.toLowerCase().includes(text)
    );
  });

  if (callerProfile && !callerProfile.is_super_admin) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-3">
        <ShieldAlert className="size-16 text-rose-500 animate-pulse" />
        <h1 className="text-xl font-bold text-white">Acesso Não Autorizado</h1>
        <p className="text-sm text-slate-400">Esta tela é estritamente confidencial e exclusiva do proprietário Super Admin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="size-6 text-emerald-400" />
            Gerenciar Usuários e Permissões
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Adicione membros à equipe, defina as regras de controle por módulo e acompanhe acessos.
          </p>
        </div>

        <Button
          onClick={handleOpenCreateModal}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2 shadow-lg hover:shadow-emerald-950"
        >
          <UserPlus className="size-4" />
          Convidar Usuário
        </Button>
      </div>

      {/* Main Board */}
      <Card className="bg-slate-900/40 border-slate-800 shadow-xl">
        <CardHeader className="p-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800">
          <div>
            <CardTitle className="text-sm font-extrabold text-white uppercase tracking-wider">
              Usuários Registrados
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 font-medium">
              Controle de acessos ativos e permissões do sistema.
            </CardDescription>
          </div>
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-9 text-xs bg-slate-950 border-slate-850 text-white"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex justify-center items-center py-20 gap-2">
              <Loader2 className="size-6 animate-spin text-emerald-500" />
              <span className="text-xs text-slate-400">Carregando usuários...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-20 text-center text-slate-500 text-sm">
              Nenhum usuário correspondente encontrado.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/25 text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">
                  <th className="px-6 py-4">Nome & Email</th>
                  <th className="px-6 py-4">Nível de Acesso</th>
                  <th className="px-6 py-4">Módulos Ativos</th>
                  <th className="px-6 py-4">Status de Senha</th>
                  <th className="px-6 py-4">Acesso</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-xs">
                {filteredUsers.map((u) => {
                  const activeModulesCount = u.user_permissions.filter((p) => p.can_view).length;
                  return (
                    <tr key={u.id} className="hover:bg-slate-900/10 transition-colors">
                      <td className="px-6 py-4 flex items-center gap-3">
                        <Avatar className="size-8 shrink-0">
                          <AvatarFallback className="bg-emerald-600/10 text-emerald-400 text-xs font-black">
                            {u.full_name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-bold text-white leading-none">{u.full_name}</p>
                          <p className="text-[10px] text-slate-500 mt-1">{u.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {u.is_super_admin ? (
                          <Badge className="bg-amber-600/10 text-amber-400 border border-amber-500/20 text-[10px] font-black uppercase">
                            <Shield className="size-3 mr-1" />
                            Super Admin
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-600/10 text-blue-400 border border-blue-500/20 text-[10px] font-semibold uppercase">
                            Usuário Comum
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 font-semibold">
                        {u.is_super_admin ? (
                          <span className="text-emerald-400 font-bold">Todos (Acesso Total)</span>
                        ) : (
                          <span className="text-slate-300">
                            {activeModulesCount === 0 ? (
                              <span className="text-red-500">Nenhum</span>
                            ) : (
                              `${activeModulesCount} de ${MODULES.length} módulos`
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {u.must_change_password ? (
                          <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-semibold">
                            Senha Pendente
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-semibold">
                            <CheckCheck className="size-3 mr-0.5 inline" />
                            Senha Definida
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {u.ativo ? (
                          <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 text-[9px] font-bold">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/10 text-red-400 border border-red-500/10 text-[9px] font-bold">
                            Inativo
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(u)}
                            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/50 text-slate-400 hover:text-white hover:border-slate-700 transition-all"
                            title="Editar usuário e permissões"
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                          {!u.is_super_admin && (
                            <button
                              onClick={() => handleDelete(u)}
                              className="p-1.5 rounded-lg border border-red-950 bg-red-950/10 text-red-400 hover:text-red-300 hover:bg-red-950/20 hover:border-red-900 transition-all"
                              title="Remover usuário permanentemente"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Save/Edit User Dialog */}
      <Dialog open={modalOpen} onOpenChange={(v) => !v && setModalOpen(false)}>
        <DialogContent className="bg-slate-900 border-slate-800 sm:max-w-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              {isEditing ? <Edit2 className="size-5 text-emerald-400" /> : <UserPlus className="size-5 text-emerald-400" />}
              {isEditing ? 'Editar Usuário e Permissões' : 'Convidar Novo Usuário'}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Configure as credenciais e o nível de acesso específico por módulo.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-5 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs font-bold">Nome Completo</Label>
                <Input
                  required
                  placeholder="Ex: Maria Silva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-slate-950 border-slate-850 h-9 text-xs text-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs font-bold">Email Corporativo</Label>
                <Input
                  required
                  type="email"
                  disabled={isEditing}
                  placeholder="Ex: maria@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-950 border-slate-850 h-9 text-xs text-white disabled:bg-slate-950 disabled:opacity-50"
                />
              </div>
            </div>

            {!isEditing && (
              <div className="space-y-1.5 p-3 rounded-lg border border-slate-800 bg-slate-950/40">
                <Label className="text-slate-300 text-xs font-bold flex items-center gap-1">
                  <Lock className="size-3.5 text-emerald-400" />
                  Senha Provisória
                </Label>
                <p className="text-[10px] text-slate-500 mb-1">
                  O usuário será forçado a alterar esta senha no seu primeiro login.
                </p>
                <div className="flex gap-2">
                  <Input
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-slate-950 border-slate-850 h-9 text-xs text-white font-mono"
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
                      let autoPass = '';
                      for (let i = 0; i < 10; i++) autoPass += chars.charAt(Math.floor(Math.random() * chars.length));
                      setPassword(autoPass + 'Aa1!');
                    }}
                    variant="outline"
                    className="border-slate-800 bg-slate-900 text-slate-300 h-9 text-xs"
                  >
                    Gerar
                  </Button>
                </div>
              </div>
            )}

            {isEditing && (
              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-950/40">
                <div>
                  <Label className="text-slate-300 text-xs font-bold">Status de Acesso</Label>
                  <p className="text-[10px] text-slate-500">Permitir ou bloquear o login deste usuário.</p>
                </div>
                <Switch checked={ativo} onCheckedChange={setAtivo} />
              </div>
            )}

            {/* Permissions Matrix Checklist Grid */}
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-bold">
                Checklist de Permissões por Módulo
              </Label>
              <p className="text-[10px] text-slate-500 mb-2">
                Defina os níveis de acesso granulares (Leitura e Operações) para cada funcionalidade.
              </p>

              <div className="border border-slate-800 rounded-xl overflow-hidden shadow-inner">
                <div className="grid grid-cols-[1fr_60px_60px_60px_60px] bg-slate-950/50 p-2.5 text-[9px] text-slate-500 font-extrabold uppercase tracking-wider border-b border-slate-800 text-center">
                  <div className="text-left pl-2">Módulo</div>
                  <div>Ver</div>
                  <div>Criar</div>
                  <div>Editar</div>
                  <div>Excluir</div>
                </div>

                <div className="divide-y divide-slate-850 bg-slate-950/10">
                  {MODULES.map((m) => {
                    const modulePerms = permMatrix[m.key] || { can_view: false, can_create: false, can_edit: false, can_delete: false };
                    
                    // Specific limits for module (e.g. Feeds has only can_view and can_create as postar)
                    const isFeeds = m.key === 'feeds';

                    return (
                      <div key={m.key} className="grid grid-cols-[1fr_60px_60px_60px_60px] p-2.5 items-center text-center">
                        <div className="text-left pl-2">
                          <p className="text-xs font-bold text-white leading-none">{m.label}</p>
                          <p className="text-[9px] text-slate-500 mt-1 line-clamp-1">{m.desc}</p>
                        </div>
                        
                        {/* View Checkbox */}
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            checked={modulePerms.can_view}
                            onChange={(e) => handleToggleMatrix(m.key, 'can_view', e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-slate-800 bg-slate-900 text-emerald-500 focus:ring-0"
                          />
                        </div>

                        {/* Create Checkbox */}
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            checked={modulePerms.can_create}
                            onChange={(e) => handleToggleMatrix(m.key, 'can_create', e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-slate-800 bg-slate-900 text-emerald-500 focus:ring-0"
                          />
                        </div>

                        {/* Edit Checkbox */}
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            disabled={isFeeds}
                            checked={modulePerms.can_edit}
                            onChange={(e) => handleToggleMatrix(m.key, 'can_edit', e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-slate-800 bg-slate-900 text-emerald-500 focus:ring-0 disabled:opacity-20"
                          />
                        </div>

                        {/* Delete Checkbox */}
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            disabled={isFeeds}
                            checked={modulePerms.can_delete}
                            onChange={(e) => handleToggleMatrix(m.key, 'can_delete', e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-slate-800 bg-slate-900 text-emerald-500 focus:ring-0 disabled:opacity-20"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter className="bg-slate-900 border-slate-850 pt-2 flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-lg hover:shadow-emerald-950"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-1" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Usuário'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
