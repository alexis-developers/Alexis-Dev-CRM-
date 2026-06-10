"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlexisLogo } from "@/components/ui/alexis-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2, Copy, Check, Loader2, ArrowRight,
  ShieldCheck, RefreshCw, QrCode, Building2, Mail,
  CreditCard, Smartphone,
} from "lucide-react";

type Step = "form" | "pix" | "checking" | "paid";
type PaymentMethod = "pix" | "card";

interface ChargeData {
  txid: string;
  pixCopiaECola: string;
  qrCodeBase64: string;
  amount: number;
  expiresAt: string;
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("form");
  const [empresa, setEmpresa] = useState(searchParams.get("company") ?? "");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const isRenewal = searchParams.get("renewal") === "1";
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [charge, setCharge] = useState<ChargeData | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [preco, setPreco] = useState<number | null>(null);
  const [licenseKey, setLicenseKey] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Card return from Efi's page
  const returnedFromCard = searchParams.get("paid") === "1" && searchParams.get("method") === "card";
  const cardChargeId = searchParams.get("chargeId");

  useEffect(() => {
    fetch("/api/preco").then((r) => r.json()).then((d) => setPreco(d.preco_atual)).catch(() => {});
  }, []);

  // Handle return from card payment page
  useEffect(() => {
    if (returnedFromCard && cardChargeId) {
      setStep("checking");
    }
  }, [returnedFromCard, cardChargeId]);

  const pollStatus = useCallback(async (txid?: string, chargeId?: string) => {
    const url = txid
      ? `/api/efi/status?txid=${txid}`
      : `/api/efi/status?chargeId=${chargeId}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    if (data.paid) {
      setLicenseKey(data.licenseKey);
      setStep("paid");
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, []);

  // Poll for PIX payment
  useEffect(() => {
    if (step === "pix" && charge?.txid) {
      pollRef.current = setInterval(() => pollStatus(charge.txid), 5000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [step, charge, pollStatus]);

  // Poll for card payment (after return from Efi)
  useEffect(() => {
    if (step === "checking" && cardChargeId) {
      pollRef.current = setInterval(() => pollStatus(undefined, cardChargeId), 4000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [step, cardChargeId, pollStatus]);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!empresa.trim() || !email.trim()) return;
    setCarregando(true);

    const res = await fetch("/api/efi/charge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, companyName: empresa, isRenewal, paymentMethod }),
    });

    const data = await res.json();
    setCarregando(false);

    if (!res.ok || !data.ok) {
      setErro(data.error ?? "Erro ao gerar cobrança. Tente novamente.");
      return;
    }

    if (data.paymentMethod === "card") {
      // Redirect to Efi's hosted card payment page
      window.location.href = data.paymentLink;
      return;
    }

    // PIX
    setCharge(data);
    setStep("pix");
  };

  const copiar = () => {
    if (charge?.pixCopiaECola) {
      navigator.clipboard.writeText(charge.pixCopiaECola);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    }
  };

  // ─── AGUARDANDO CONFIRMAÇÃO (cartão) ─────────────────────────────────────────
  if (step === "checking") {
    return (
      <div className="min-h-screen bg-[#090D16] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="rounded-2xl border border-primary/20 bg-slate-900/80 p-10 shadow-2xl">
            <div className="flex justify-center mb-5">
              <div className="h-20 w-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
              </div>
            </div>
            <h1 className="text-xl font-black text-white mb-2">Aguardando confirmação</h1>
            <p className="text-slate-400 text-sm mb-6">
              Verificando o pagamento com o banco. Isso pode levar alguns segundos.
            </p>
            <div className="rounded-lg border border-green-500/10 bg-green-500/5 px-4 py-3 text-xs text-green-400 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
              Após confirmação, a licença será enviada para <strong className="text-white ml-1">{email || searchParams.get("email")}</strong>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── PAGO ────────────────────────────────────────────────────────────────────
  if (step === "paid") {
    return (
      <div className="min-h-screen bg-[#090D16] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="rounded-2xl border border-green-500/20 bg-slate-900/80 p-10 shadow-2xl">
            <div className="flex justify-center mb-5">
              <div className="h-20 w-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-400" />
              </div>
            </div>
            <h1 className="text-2xl font-black text-white mb-2">Pagamento confirmado!</h1>
            <p className="text-slate-400 text-sm mb-6">
              Sua licença foi gerada e enviada para <strong className="text-white">{email || searchParams.get("email")}</strong>
            </p>

            {licenseKey && (
              <div className="bg-[#090D16] border-2 border-dashed border-primary/40 rounded-xl p-5 mb-6">
                <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Sua chave de licença</p>
                <p className="font-mono text-lg font-bold text-primary tracking-widest break-all">{licenseKey}</p>
              </div>
            )}

            <Link
              href={licenseKey ? `/signup?key=${licenseKey}` : "/signup"}
              className="inline-flex items-center gap-2 w-full justify-center bg-primary hover:bg-primary/90 text-[#090D16] font-black py-4 rounded-xl transition-all"
            >
              Ativar minha licença <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="text-xs text-slate-500 mt-4">Verifique também seu email — enviamos a chave lá também.</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── PIX QR CODE ─────────────────────────────────────────────────────────────
  if (step === "pix" && charge) {
    const expiresIn = Math.max(0, Math.floor((new Date(charge.expiresAt).getTime() - Date.now()) / 60000));
    return (
      <div className="min-h-screen bg-[#090D16] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-r from-primary/10 to-violet-900/20 border-b border-white/5 px-6 py-4 text-center">
              <AlexisLogo className="h-8 w-auto mx-auto mb-2" />
              <h2 className="text-white font-black text-lg">Pague com PIX</h2>
              <p className="text-slate-400 text-xs mt-1">
                Licença Alexis CRM — 1 ano · {empresa}
              </p>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between bg-slate-800/50 rounded-xl px-5 py-3">
                <span className="text-slate-400 text-sm">Total a pagar</span>
                <span className="text-2xl font-black text-white">
                  R$ {charge.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>

              {charge.qrCodeBase64 ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-white p-3 rounded-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`data:image/png;base64,${charge.qrCodeBase64}`} alt="PIX QR Code" className="h-48 w-48" />
                  </div>
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <QrCode className="h-3.5 w-3.5" /> Escaneie com o app do seu banco
                  </p>
                </div>
              ) : (
                <div className="flex justify-center p-8 text-slate-600">
                  <QrCode className="h-16 w-16" />
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">PIX Copia e Cola</p>
                <div className="flex gap-2">
                  <div className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono truncate">
                    {charge.pixCopiaECola}
                  </div>
                  <Button size="sm" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-700 h-9 px-3 shrink-0" onClick={copiar}>
                    {copiado ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Expira em ~{expiresIn} min</span>
                <span className="flex items-center gap-1 text-primary animate-pulse">
                  <RefreshCw className="h-3 w-3" /> Aguardando pagamento...
                </span>
              </div>

              <div className="rounded-lg border border-green-500/10 bg-green-500/5 px-4 py-3 text-xs text-green-400 flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                Após o pagamento, sua licença é enviada automaticamente para {email}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── FORMULÁRIO ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#090D16] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-r from-primary/10 to-violet-900/20 border-b border-white/5 px-6 pt-8 pb-6 text-center">
            <AlexisLogo className="h-10 w-auto mx-auto mb-4" />
            <h1 className="text-2xl font-black text-white mb-1">
              {isRenewal ? "Renovar Licença" : "Comprar Licença OEM"}
            </h1>
            <p className="text-slate-400 text-sm">
              {isRenewal ? "Estenda sua licença por mais 1 ano" : "CRM completo para sua empresa"}
            </p>
            {preco && (
              <div className="mt-4 inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-4 py-2 rounded-full">
                <span className="text-2xl font-black">R$ {preco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                <span className="text-sm opacity-70">/ano</span>
              </div>
            )}
          </div>

          <form onSubmit={handleCheckout} className="p-6 space-y-4">
            {erro && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{erro}</div>
            )}

            <div className="space-y-2">
              <Label className="text-slate-300 text-xs uppercase tracking-wider font-bold">Nome da Empresa</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  className="pl-10 bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600"
                  placeholder="Empresa XYZ Ltda"
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300 text-xs uppercase tracking-wider font-bold">E-mail para receber a licença</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  type="email"
                  className="pl-10 bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600"
                  placeholder="contato@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <p className="text-xs text-slate-500">A chave de licença será enviada para este email após o pagamento.</p>
            </div>

            {/* Seletor de método de pagamento */}
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs uppercase tracking-wider font-bold">Forma de pagamento</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("pix")}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                    paymentMethod === "pix"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-white/10 bg-slate-800/40 text-slate-400 hover:border-white/20"
                  }`}
                >
                  <Smartphone className="h-5 w-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">PIX</span>
                  <span className="text-[10px] opacity-70">Aprovação imediata</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("card")}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                    paymentMethod === "card"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-white/10 bg-slate-800/40 text-slate-400 hover:border-white/20"
                  }`}
                >
                  <CreditCard className="h-5 w-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">Cartão</span>
                  <span className="text-[10px] opacity-70">Parcelado</span>
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={carregando}
              className="w-full bg-primary hover:bg-primary/90 text-[#090D16] font-black py-4 rounded-xl text-sm uppercase tracking-widest mt-2"
            >
              {carregando
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {paymentMethod === "pix" ? "Gerando PIX..." : "Preparando pagamento..."}
                  </>
                : paymentMethod === "pix"
                  ? <>{isRenewal ? "Gerar PIX de renovação" : "Gerar PIX"} <ArrowRight className="h-4 w-4 ml-1" /></>
                  : <>{isRenewal ? "Pagar renovação com cartão" : "Pagar com cartão de crédito"} <ArrowRight className="h-4 w-4 ml-1" /></>
              }
            </Button>

            {paymentMethod === "card" && (
              <p className="text-xs text-slate-500 text-center">
                Você será redirecionado para a página segura da Efi Bank para inserir os dados do cartão.
              </p>
            )}

            <div className="flex items-center gap-3 text-xs text-slate-500 justify-center pt-1">
              <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
              <span>Pagamento seguro · Dados protegidos · Confirmação automática</span>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600 mt-4">
          Já tem uma conta?{" "}
          <Link href="/login" className="text-primary hover:underline">Entrar</Link>
          {" · "}
          <Link href="/planos" className="text-primary hover:underline">Ver planos</Link>
        </p>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#090D16] flex items-center justify-center"><div className="text-slate-400">Carregando...</div></div>}>
      <CheckoutContent />
    </Suspense>
  );
}
