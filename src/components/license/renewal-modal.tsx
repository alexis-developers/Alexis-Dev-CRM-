"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, RefreshCw, Mail, MessageCircle,
  TrendingUp, Calendar, Loader2, LogOut, ShieldAlert,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PrecoData {
  preco_atual: number;
  preco_mensal: number;
  ipca_acumulado_pct: number;
  cotacao_dolar: number | null;
  reajuste_pct: number;
  fallback?: boolean;
}

interface Props {
  email?: string;
  expiresAt?: string;
}

export function RenewalModal({ email, expiresAt }: Props) {
  const [preco, setPreco] = useState<PrecoData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [saindo, setSaindo] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/preco")
      .then((r) => r.json())
      .then((data) => { setPreco(data); setCarregando(false); })
      .catch(() => setCarregando(false));
  }, []);

  const handleLogout = async () => {
    setSaindo(true);
    await authClient.signOut();
    router.push("/login");
  };

  const assunto = encodeURIComponent("Renovação de Licença — Alexis CRM");
  const corpo = encodeURIComponent(
    `Olá,\n\nGostaria de renovar minha licença do Alexis CRM.\n\nE-mail cadastrado: ${email ?? "(informe seu e-mail)"}\n\nAguardo retorno.\n\nObrigado!`
  );
  const whatsappMsg = encodeURIComponent(
    `Olá! Preciso renovar minha licença do Alexis CRM. E-mail: ${email ?? "(meu e-mail)"}`
  );
  const checkoutUrl = `/checkout?renewal=1${email ? `&email=${encodeURIComponent(email)}` : ''}`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#090D16]">
      {/* Background decorativo */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-[50%] h-[50%] bg-red-900/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[40%] h-[40%] bg-orange-900/8 blur-[120px] rounded-full" />
      </div>

      <div className="relative w-full max-w-lg mx-4 z-10">
        {/* Card principal */}
        <div className="rounded-2xl border border-red-500/20 bg-slate-900/90 backdrop-blur shadow-2xl overflow-hidden">
          {/* Header vermelho */}
          <div className="bg-gradient-to-r from-red-900/40 to-orange-900/30 border-b border-red-500/20 px-8 pt-8 pb-6 text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <ShieldAlert className="h-8 w-8 text-red-400" />
              </div>
            </div>
            <h1 className="text-2xl font-black text-white mb-2">
              Licença Expirada
            </h1>
            <p className="text-slate-400 text-sm">
              Sua licença do <span className="text-white font-semibold">Alexis CRM</span> venceu.
              {expiresAt && (
                <span className="block mt-1 text-red-400 text-xs">
                  Expirou em {format(parseISO(expiresAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              )}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              ⚡ Seus dados estão seguros — apenas o acesso está suspenso.
            </p>
          </div>

          {/* Preço */}
          <div className="px-8 py-6">
            {carregando ? (
              <div className="flex items-center justify-center gap-2 text-slate-400 py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Carregando valores...</span>
              </div>
            ) : preco ? (
              <div className="space-y-4">
                {/* Valor de renovação */}
                <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-5 text-center">
                  <p className="text-xs text-slate-400 uppercase tracking-widest mb-2 font-bold">
                    Renovação Anual — Alexis CRM
                  </p>
                  <div className="flex items-end justify-center gap-2 mb-1">
                    <span className="text-4xl font-black text-white">
                      R$ {preco.preco_atual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-slate-400 mb-1">/ano</span>
                  </div>
                  <p className="text-sm text-slate-500">
                    ou <span className="text-primary font-semibold">R$ {preco.preco_mensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês</span> parcelado
                  </p>
                </div>

                {/* Indicadores do reajuste */}
                {preco.reajuste_pct > 0 && (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg bg-slate-800/40 border border-slate-700/30 p-3 flex items-start gap-2">
                      <TrendingUp className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-slate-400">IPCA Acumulado</p>
                        <p className="text-white font-bold">{preco.ipca_acumulado_pct}%</p>
                      </div>
                    </div>
                    {preco.cotacao_dolar && (
                      <div className="rounded-lg bg-slate-800/40 border border-slate-700/30 p-3 flex items-start gap-2">
                        <span className="text-green-400 font-bold text-sm shrink-0">$</span>
                        <div>
                          <p className="text-slate-400">Dólar (PTAX)</p>
                          <p className="text-white font-bold">R$ {preco.cotacao_dolar.toFixed(2)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {preco.fallback && (
                  <p className="text-xs text-amber-500/70 text-center">
                    * Preço base sem reajuste (dados externos indisponíveis no momento)
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-slate-400 text-sm">Entre em contato para obter o valor de renovação.</p>
              </div>
            )}

            {/* Botão principal de checkout */}
            <div className="mt-5 space-y-3">
              <a
                href={checkoutUrl}
                className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary hover:bg-primary/90 text-[#090D16] font-black py-3.5 text-sm transition-colors"
              >
                <RefreshCw className="h-4 w-4" /> Renovar agora com PIX
              </a>
              <p className="text-xs text-center text-slate-500 uppercase tracking-wider font-bold">
                Ou entre em contato
              </p>
              <div className="grid grid-cols-2 gap-3">
                <a
                  href={`mailto:pastoralexdocavaco@gmail.com?subject=${assunto}&body=${corpo}`}
                  className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors px-4 py-3 text-sm font-semibold"
                >
                  <Mail className="h-4 w-4" /> E-mail
                </a>
                <a
                  href={`https://wa.me/${process.env.NEXT_PUBLIC_CONTACT_WHATSAPP ?? '5511999999999'}?text=${whatsappMsg}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors px-4 py-3 text-sm font-semibold"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              </div>

              <Button
                variant="ghost"
                className="w-full text-slate-500 hover:text-slate-300 text-xs"
                onClick={handleLogout}
                disabled={saindo}
              >
                {saindo ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <LogOut className="h-3.5 w-3.5 mr-1" />}
                Sair da conta
              </Button>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-700/50 px-8 py-3 text-center">
            <p className="text-xs text-slate-600">
              O reajuste anual é baseado no IPCA oficial (IBGE) + variação do dólar (BCB)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
