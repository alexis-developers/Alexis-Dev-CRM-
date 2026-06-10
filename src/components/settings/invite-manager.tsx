"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Plus, Trash2, Check, Clock, UserPlus, Link2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Invite {
  id: string;
  token: string;
  email: string | null;
  role: string | null;
  created_by_name: string | null;
  used_at: string | null;
  expires_at: string;
  created_at: string;
}

export function InviteManager() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("agent");
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await fetch("/api/invites");
    if (res.ok) {
      const data = await res.json();
      setInvites(data);
    }
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const criarConvite = async () => {
    setSalvando(true);
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() || undefined, role }),
    });
    if (res.ok) {
      setDialogAberto(false);
      setEmail("");
      setRole("agent");
      await carregar();
    }
    setSalvando(false);
  };

  const revogar = async (id: string) => {
    if (!confirm("Revogar este convite?")) return;
    await fetch(`/api/invites?id=${id}`, { method: "DELETE" });
    await carregar();
  };

  const copiarLink = (token: string) => {
    const url = `${baseUrl}/signup?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiado(token);
    setTimeout(() => setCopiado(null), 2000);
  };

  const isExpirado = (expires: string) => new Date(expires) < new Date();

  const pendentes = invites.filter((i) => !i.used_at && !isExpirado(i.expires_at));
  const usados = invites.filter((i) => i.used_at);
  const expirados = invites.filter((i) => !i.used_at && isExpirado(i.expires_at));

  const StatusBadge = ({ invite }: { invite: Invite }) => {
    if (invite.used_at) return <Badge className="bg-green-500/15 text-green-400 border-green-500/20">Utilizado</Badge>;
    if (isExpirado(invite.expires_at)) return <Badge className="bg-red-500/15 text-red-400 border-red-500/20">Expirado</Badge>;
    return <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/20">Pendente</Badge>;
  };

  const RoleLabel = ({ role }: { role: string | null }) => {
    const map: Record<string, string> = { super_admin: "Super Admin", admin: "Admin", agent: "Agente" };
    return <span className="text-xs text-slate-400">{map[role ?? "agent"] ?? role}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Convites
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Gere links de convite para novos usuários. Cada link expira em 7 dias.
            </p>
          </div>
          <Button
            onClick={() => setDialogAberto(true)}
            className="bg-primary hover:bg-primary/90 text-[#090D16] font-bold shrink-0"
          >
            <Plus className="h-4 w-4 mr-1" />
            Novo Convite
          </Button>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-slate-800/50 p-3 text-center">
            <p className="text-xl font-bold text-blue-400">{pendentes.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">Pendentes</p>
          </div>
          <div className="rounded-lg bg-slate-800/50 p-3 text-center">
            <p className="text-xl font-bold text-green-400">{usados.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">Utilizados</p>
          </div>
          <div className="rounded-lg bg-slate-800/50 p-3 text-center">
            <p className="text-xl font-bold text-red-400">{expirados.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">Expirados</p>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 overflow-hidden">
        {carregando ? (
          <div className="p-8 text-center text-slate-500 text-sm">Carregando...</div>
        ) : invites.length === 0 ? (
          <div className="p-8 text-center">
            <Link2 className="h-8 w-8 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Nenhum convite gerado ainda.</p>
            <p className="text-slate-500 text-xs mt-1">Crie um convite para adicionar novos usuários ao sistema.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {invites.map((invite) => (
              <div key={invite.id} className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge invite={invite} />
                    <RoleLabel role={invite.role} />
                    {invite.email && (
                      <span className="text-sm text-white font-medium">{invite.email}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {invite.used_at
                        ? `Usado em ${format(parseISO(invite.used_at), "dd/MM/yyyy", { locale: ptBR })}`
                        : isExpirado(invite.expires_at)
                        ? `Expirou em ${format(parseISO(invite.expires_at), "dd/MM/yyyy", { locale: ptBR })}`
                        : `Expira em ${format(parseISO(invite.expires_at), "dd/MM/yyyy", { locale: ptBR })}`}
                    </span>
                    <span>Criado por {invite.created_by_name ?? "sistema"}</span>
                  </div>
                  {!invite.used_at && !isExpirado(invite.expires_at) && (
                    <p className="text-xs text-slate-600 mt-1 font-mono truncate">
                      {baseUrl}/signup?token={invite.token}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!invite.used_at && !isExpirado(invite.expires_at) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-slate-700 text-slate-300 hover:bg-slate-800 h-8 px-2"
                      onClick={() => copiarLink(invite.token)}
                    >
                      {copiado === invite.token ? (
                        <Check className="h-3.5 w-3.5 text-green-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                  {!invite.used_at && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:bg-red-500/10 hover:text-red-300 h-8 px-2"
                      onClick={() => revogar(invite.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog criar convite */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Criar Convite</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs uppercase tracking-wider font-bold">
                E-mail (opcional)
              </Label>
              <Input
                type="email"
                placeholder="convidado@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
              <p className="text-xs text-slate-500">
                Se informado, o e-mail será pré-preenchido no cadastro.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300 text-xs uppercase tracking-wider font-bold">
                Nível de acesso
              </Label>
              <Select value={role} onValueChange={(v) => setRole(v ?? "agent")}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="agent" className="text-white hover:bg-slate-700">Agente</SelectItem>
                  <SelectItem value="admin" className="text-white hover:bg-slate-700">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogAberto(false)} className="text-slate-300">
              Cancelar
            </Button>
            <Button
              onClick={criarConvite}
              disabled={salvando}
              className="bg-primary hover:bg-primary/90 text-[#090D16] font-bold"
            >
              {salvando ? "Gerando..." : "Gerar Convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
