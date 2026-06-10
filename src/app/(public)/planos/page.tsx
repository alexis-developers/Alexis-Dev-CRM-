"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlexisLogo } from "@/components/ui/alexis-logo";
import {
  CheckCircle2, MessageSquare, Users, BarChart2, Zap,
  Shield, Globe, HeadphonesIcon, ArrowRight, TrendingUp,
  Phone, Calendar, FileText, Bot,
} from "lucide-react";

interface Preco {
  preco_atual: number;
  preco_mensal: number;
  ipca_acumulado_pct: number;
  reajuste_pct: number;
}

const FEATURES = [
  { icon: MessageSquare, label: "Caixa de entrada WhatsApp" },
  { icon: Users, label: "CRM completo de contatos" },
  { icon: TrendingUp, label: "Pipeline de vendas (Kanban)" },
  { icon: Zap, label: "Automações de mensagens" },
  { icon: BarChart2, label: "Relatórios e estatísticas" },
  { icon: Phone, label: "Registro de chamadas" },
  { icon: Calendar, label: "Agenda de reuniões" },
  { icon: FileText, label: "Gestão de documentos" },
  { icon: HeadphonesIcon, label: "Suporte / Desk de tickets" },
  { icon: Bot, label: "Transmissões em massa" },
  { icon: Shield, label: "Multi-empresa isolado" },
  { icon: Globe, label: "Deploy Cloudflare (global)" },
];

export default function PlanosPage() {
  const [preco, setPreco] = useState<Preco | null>(null);

  useEffect(() => {
    fetch("/api/preco").then((r) => r.json()).then(setPreco).catch(() => {});
  }, []);

  const valorAnual = preco?.preco_atual ?? 680;
  const valorMensal = preco?.preco_mensal ?? (valorAnual / 12);

  return (
    <div className="min-h-screen bg-[#090D16] text-white">
      {/* Nav */}
      <nav className="border-b border-white/5 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <AlexisLogo className="h-8 w-auto" />
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-slate-400 hover:text-white text-sm transition-colors">
            Entrar
          </Link>
          <Link
            href="/checkout"
            className="bg-primary hover:bg-primary/90 text-[#090D16] font-bold text-sm px-4 py-2 rounded-lg transition-colors"
          >
            Comprar licença
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-xs font-bold mb-6 border border-primary/20">
          <Shield className="h-3.5 w-3.5" /> Licença OEM — 1 empresa, 1 banco de dados
        </div>
        <h1 className="text-5xl font-black tracking-tight mb-6 leading-tight">
          CRM para WhatsApp<br />
          <span className="text-primary">pronto para sua empresa</span>
        </h1>
        <p className="text-slate-400 text-xl max-w-2xl mx-auto mb-10">
          Gerencie contatos, leads, vendas e conversas do WhatsApp em um único sistema.
          Cada empresa tem seu ambiente isolado e seguro.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/checkout"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-[#090D16] font-black text-base px-8 py-4 rounded-xl transition-all shadow-lg shadow-primary/20 active:scale-[0.98]"
          >
            Comprar agora <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 border border-white/10 text-slate-300 hover:bg-white/5 font-semibold text-sm px-6 py-4 rounded-xl transition-colors"
          >
            Já tenho licença — Entrar
          </Link>
        </div>
      </div>

      {/* Pricing card */}
      <div className="max-w-lg mx-auto px-6 mb-20">
        <div className="rounded-2xl border border-primary/20 bg-slate-900/60 overflow-hidden shadow-2xl shadow-primary/5">
          {/* Badge */}
          <div className="bg-primary/10 border-b border-primary/20 px-6 py-3 text-center">
            <span className="text-primary text-xs font-bold uppercase tracking-widest">Plano OEM Anual</span>
          </div>

          <div className="p-8 text-center">
            <div className="flex items-end justify-center gap-2 mb-2">
              <span className="text-5xl font-black text-white">
                R$ {valorAnual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <p className="text-slate-400 text-sm mb-1">por empresa / por ano</p>
            <p className="text-primary text-xs font-semibold">
              ou R$ {valorMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês parcelado
            </p>

            {preco && preco.reajuste_pct > 0 && (
              <p className="text-slate-500 text-xs mt-2">
                Reajuste IPCA {preco.ipca_acumulado_pct}% aplicado
              </p>
            )}

            <div className="mt-6 space-y-3 text-left">
              {["1 ano de licença", "Banco de dados exclusivo", "WhatsApp API própria",
                "Equipe ilimitada (por convite)", "Atualizações incluídas",
                "Suporte por email e WhatsApp"].map((f) => (
                <div key={f} className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-slate-300 text-sm">{f}</span>
                </div>
              ))}
            </div>

            <Link
              href="/checkout"
              className="mt-8 flex items-center justify-center gap-2 w-full bg-primary hover:bg-primary/90 text-[#090D16] font-black py-4 rounded-xl transition-all shadow-lg shadow-primary/20 active:scale-[0.98]"
            >
              Comprar com PIX <ArrowRight className="h-4 w-4" />
            </Link>

            <p className="text-slate-500 text-xs mt-4">
              Pagamento via PIX · Licença enviada por email após confirmação
            </p>
          </div>
        </div>
      </div>

      {/* Features grid */}
      <div className="max-w-6xl mx-auto px-6 mb-24">
        <h2 className="text-2xl font-bold text-center mb-10">O que está incluído</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {FEATURES.map(({ icon: Icon, label }) => (
            <div key={label} className="rounded-xl border border-white/5 bg-slate-900/40 p-4 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <span className="text-slate-300 text-sm">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center">
        <p className="text-slate-500 text-sm">
          © {new Date().getFullYear()} Alexis CRM · Dúvidas?{" "}
          <a href="mailto:pastoralexdocavaco@gmail.com" className="text-primary hover:underline">
            pastoralexdocavaco@gmail.com
          </a>
        </p>
      </footer>
    </div>
  );
}
