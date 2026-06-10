"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Key, Plus, Copy, Check, Ban, Download, Loader2, ShieldOff,
  CheckCircle2, XCircle, Clock, Hash,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LicenseKey {
  id: string;
  key: string;
  label: string | null;
  role: string | null;
  max_uses: number | null;
  use_count: number | null;
  is_active: boolean | number | null;
  created_by_name: string | null;
  expires_at: string | null;
  created_at: string;
}

export function LicenseManager() {
  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [ultimasGeradas, setUltimasGeradas] = useState<string[]>([]);
  const [arquivoSalvo, setArquivoSalvo] = useState<string | null>(null);

  // Form
  const [quantidade, setQuantidade] = useState(1);
  const [label, setLabel] = useState("");
  const [role, setRole] = useState("agent");
  const [maxUses, setMaxUses] = useState(1);
  const [expiraDias, setExpiraDias] = useState<number | "">("");

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await fetch("/api/licenses");
    if (res.ok) setKeys(await res.json());
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const gerar = async () => {
    setSalvando(true);
    const res = await fetch("/api/licenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quantity: quantidade,
        role,
        label: label.trim(),
        max_uses: maxUses,
        expires_days: expiraDias || undefined,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setUltimasGeradas(data.generated ?? []);
      setArquivoSalvo(data.savedFile ?? null);
      setDialogAberto(false);
      setLabel(""); setQuantidade(1); setRole("agent"); setMaxUses(1); setExpiraDias("");
      await carregar();
    }
    setSalvando(false);
  };

  const revogar = async (id: string, key: string) => {
    if (!confirm(`Revogar a chave ${key}?`)) return;
    await fetch(`/api/licenses?id=${id}`, { method: "DELETE" });
    await carregar();
  };

  const copiar = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiado(id);
    setTimeout(() => setCopiado(null), 2000);
  };

  const copiarLink = (key: string) => {
    const url = `${baseUrl}/signup?key=${key}`;
    copiar(url, `link-${key}`);
  };

  const isAtivo = (k: LicenseKey) => !!k.is_active && (k.use_count ?? 0) < (k.max_uses ?? 1) && (!k.expires_at || new Date(k.expires_at) >= new Date());

  const StatusBadge = ({ k }: { k: LicenseKey }) => {
    if (!k.is_active) return <Badge className="bg-red-500/15 text-red-400 border-red-500/20 text-[10px]"><ShieldOff className="h-3 w-3 mr-1" />Revogada</Badge>;
    if (k.expires_at && new Date(k.expires_at) < new Date()) return <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/20 text-[10px]"><Clock className="h-3 w-3 mr-1" />Expirada</Badge>;
    if ((k.use_count ?? 0) >= (k.max_uses ?? 1)) return <Badge className="bg-slate-500/15 text-slate-400 border-slate-500/20 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Esgotada</Badge>;
    return <Badge className="bg-green-500/15 text-green-400 border-green-500/20 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Ativa</Badge>;
  };

  const ativas = keys.filter(isAtivo).length;
  const usadas = keys.filter(k => (k.use_count ?? 0) > 0).length;
  const revogadas = keys.filter(k => !k.is_active).length;

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Licenças OEM
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Gere chaves no formato <span className="font-mono text-primary text-xs">ALEXIS-XXXX-XXXX-XXXX-XXXX</span> para liberar acesso ao CRM.
              As chaves são salvas automaticamente em <span className="font-mono text-xs text-slate-300">licenses/</span>.
            </p>
          </div>
          <Button onClick={() => setDialogAberto(true)} className="bg-primary hover:bg-primary/90 text-[#090D16] font-bold shrink-0">
            <Plus className="h-4 w-4 mr-1" /> Gerar Chaves
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {[["Ativas", ativas, "text-green-400"], ["Utilizadas", usadas, "text-blue-400"], ["Revogadas", revogadas, "text-red-400"]].map(([l, v, c]) => (
            <div key={String(l)} className="rounded-lg bg-slate-800/50 p-3 text-center">
              <p className={`text-xl font-bold ${c}`}>{v}</p>
              <p className="text-xs text-slate-400 mt-0.5">{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Últimas geradas */}
      {ultimasGeradas.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-primary flex items-center gap-2">
              <Download className="h-4 w-4" />
              {ultimasGeradas.length} chave(s) gerada(s) com sucesso
            </p>
            {arquivoSalvo && (
              <span className="text-xs text-slate-400 font-mono">Salvo em: licenses/{arquivoSalvo}</span>
            )}
          </div>
          <div className="space-y-2">
            {ultimasGeradas.map((k) => (
              <div key={k} className="flex items-center gap-3 bg-slate-900/60 rounded-lg px-4 py-2">
                <span className="font-mono text-sm text-white tracking-widest flex-1">{k}</span>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-slate-400 hover:text-white" onClick={() => copiar(k, k)}>
                  {copiado === k ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-slate-400 hover:text-blue-400" onClick={() => copiarLink(k)}>
                  {copiado === `link-${k}` ? <Check className="h-3.5 w-3.5 text-green-400" /> : <span className="text-xs">Link</span>}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de todas as chaves */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/50 flex items-center gap-2">
          <Hash className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-300">Todas as chaves ({keys.length})</span>
        </div>
        {carregando ? (
          <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : keys.length === 0 ? (
          <div className="p-8 text-center">
            <Key className="h-8 w-8 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Nenhuma chave gerada ainda.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/30">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm text-white tracking-widest">{k.key}</span>
                    <StatusBadge k={k} />
                    <span className="text-[10px] text-slate-500 uppercase">{k.role === "admin" ? "Admin" : "Agente"}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span>{k.use_count ?? 0}/{k.max_uses ?? 1} uso(s)</span>
                    {k.label && <span>· {k.label}</span>}
                    {k.expires_at && <span>· Expira {format(parseISO(k.expires_at), "dd/MM/yy", { locale: ptBR })}</span>}
                    <span>· {format(parseISO(k.created_at), "dd/MM/yy", { locale: ptBR })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isAtivo(k) && (
                    <>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-slate-400 hover:text-white" title="Copiar chave" onClick={() => copiar(k.key, k.id)}>
                        {copiado === k.id ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-slate-400 hover:text-blue-400 text-xs" title="Copiar link de cadastro" onClick={() => copiarLink(k.key)}>
                        {copiado === `link-${k.key}` ? <Check className="h-3.5 w-3.5 text-green-400" /> : "Link"}
                      </Button>
                    </>
                  )}
                  {k.is_active && (k.use_count ?? 0) < (k.max_uses ?? 1) && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-red-400 hover:bg-red-500/10" title="Revogar" onClick={() => revogar(k.id, k.key)}>
                      <Ban className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog gerar */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" /> Gerar Chaves de Licença
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-slate-300 text-xs uppercase tracking-wider font-bold">Quantidade</Label>
                <Input
                  type="number" min={1} max={50}
                  value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300 text-xs uppercase tracking-wider font-bold">Usos por chave</Label>
                <Input
                  type="number" min={1} max={999}
                  value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300 text-xs uppercase tracking-wider font-bold">Nível de acesso</Label>
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

            <div className="space-y-2">
              <Label className="text-slate-300 text-xs uppercase tracking-wider font-bold">Descrição / Cliente (opcional)</Label>
              <Input
                placeholder="Ex: Cliente ABC, Pacote Pro..."
                value={label} onChange={(e) => setLabel(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300 text-xs uppercase tracking-wider font-bold">Expiração em dias (opcional)</Label>
              <Input
                type="number" min={1} placeholder="Ex: 365 (sem limite se vazio)"
                value={expiraDias} onChange={(e) => setExpiraDias(e.target.value ? Number(e.target.value) : "")}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3 text-xs text-slate-400">
              As chaves serão salvas em <span className="font-mono text-slate-300">licenses/keys-[data].txt</span> no servidor para você retirar.
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogAberto(false)} className="text-slate-300">Cancelar</Button>
            <Button onClick={gerar} disabled={salvando} className="bg-primary hover:bg-primary/90 text-[#090D16] font-bold">
              {salvando ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Gerando...</> : <><Key className="h-4 w-4 mr-1" />Gerar {quantidade} Chave(s)</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
