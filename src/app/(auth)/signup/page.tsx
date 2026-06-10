"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlexisLogo } from "@/components/ui/alexis-logo";
import {
  Mail, Lock, Eye, EyeOff, User, ArrowRight,
  ShieldCheck, Loader2, Key, CheckCircle2, XCircle,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────
type AccessMode = "checking" | "first_user" | "invite" | "key_entry" | "blocked";

export default function SignupPage() {
  return (
    <Suspense>
      <SignupContent />
    </Suspense>
  );
}

function SignupContent() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [licenseKey, setLicenseKey] = useState("");
  const [keyValida, setKeyValida] = useState<boolean | null>(null);
  const [keyChecking, setKeyChecking] = useState(false);
  const [keyErro, setKeyErro] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [accessMode, setAccessMode] = useState<AccessMode>("checking");
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parallax 3D tilt
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const onMove = (e: MouseEvent) => {
      const x = (window.innerWidth / 2 - e.pageX) / 45;
      const y = (window.innerHeight / 2 - e.pageY) / 45;
      card.style.transform = `perspective(1000px) rotateY(${x}deg) rotateX(${y}deg)`;
      card.style.transition = "none";
    };
    const onLeave = () => {
      card.style.transform = "perspective(1000px) rotateY(0deg) rotateX(0deg)";
      card.style.transition = "transform 0.5s ease-out";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseleave", onLeave); };
  }, []);

  // Detect access mode on mount
  useEffect(() => {
    async function detectAccess() {
      const token = searchParams.get("token");
      const key = searchParams.get("key")?.toUpperCase();

      // Pre-fill key from URL
      if (key) setLicenseKey(key);

      // Check invite token
      if (token) {
        const res = await fetch(`/api/invites/check?token=${token}`);
        const data = await res.json();
        if (data.valid) {
          setInviteToken(token);
          if (data.isFirstUser) { setAccessMode("first_user"); return; }
          setAccessMode("invite");
          if (data.email) { setEmail(data.email); setInviteEmail(data.email); }
          return;
        }
      }

      // Check if first user (no token needed)
      const res = await fetch("/api/invites/check");
      const data = await res.json();
      if (data.isFirstUser) { setAccessMode("first_user"); return; }

      // If key in URL, pre-validate it
      if (key) {
        const kRes = await fetch(`/api/licenses/validate?key=${encodeURIComponent(key)}`);
        const kData = await kRes.json();
        if (kData.valid) { setKeyValida(true); setAccessMode("key_entry"); return; }
        setKeyErro(kData.error ?? "Chave inválida.");
      }

      // Allow key entry mode (user types key manually)
      setAccessMode("key_entry");
    }
    detectAccess();
  }, [searchParams]);

  // Live key validation (debounced)
  useEffect(() => {
    if (accessMode !== "key_entry") return;
    const formatted = licenseKey.trim().toUpperCase();
    if (formatted.length < 22) { setKeyValida(null); setKeyErro(null); return; }

    const timer = setTimeout(async () => {
      setKeyChecking(true);
      setKeyErro(null);
      const res = await fetch(`/api/licenses/validate?key=${encodeURIComponent(formatted)}`);
      const data = await res.json();
      setKeyValida(data.valid);
      setKeyErro(data.valid ? null : (data.error ?? "Chave inválida."));
      setKeyChecking(false);
    }, 600);

    return () => clearTimeout(timer);
  }, [licenseKey, accessMode]);

  // Auto-format key as user types
  const handleKeyInput = (val: string) => {
    const clean = val.replace(/[^A-Za-z0-9-]/g, "").toUpperCase();
    setLicenseKey(clean);
  };

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (accessMode === "key_entry" && !keyValida) {
      setErro("Informe uma chave de licença válida para continuar.");
      return;
    }
    if (senha !== confirmarSenha) { setErro("As senhas não coincidem."); return; }
    if (senha.length < 6) { setErro("A senha deve ter pelo menos 6 caracteres."); return; }
    if (!nome.trim()) { setErro("Informe seu nome completo."); return; }

    setCarregando(true);

    const result = await authClient.signUp.email({ email, password: senha, name: nome });

    if (result.error) {
      const msg = result.error.message ?? "";
      setErro(msg.toLowerCase().includes("already") || msg.toLowerCase().includes("exist")
        ? "Este e-mail já está em uso."
        : msg || "Erro ao criar conta. Tente novamente.");
      setCarregando(false);
      return;
    }

    const userId = result.data?.user?.id;
    if (userId) {
      if (accessMode === "key_entry") {
        await fetch("/api/licenses/consume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: licenseKey.trim().toUpperCase(), userId, userName: nome, userEmail: email }),
        });
      } else {
        await fetch("/api/invites/consume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: inviteToken, userId, userName: nome, userEmail: email }),
        });
      }
    }

    router.push("/dashboard");
  };

  // ─── Tela de loading ─────────────────────────────────────────────────────────
  if (accessMode === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-mesh">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  // ─── Formulário principal ────────────────────────────────────────────────────
  return (
    <div className="bg-gradient-mesh min-h-screen w-full flex items-center justify-center p-4 flex-col overflow-hidden relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-secondary/5 blur-[120px] rounded-full" />
      </div>

      <main className="relative w-full max-w-[460px] z-10">
        <div
          ref={cardRef}
          className="glass rounded-xl p-8 md:p-10 shadow-2xl transition-all duration-500 transform-gpu"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Header */}
          <div className="flex flex-col items-center mb-7 text-center" style={{ transform: "translateZ(30px)" }}>
            <div className="mb-5 floating">
              <AlexisLogo className="h-12 w-auto object-contain" />
            </div>

            {accessMode === "first_user" && (
              <div className="mb-3 flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-bold">
                <ShieldCheck className="h-3.5 w-3.5" />
                Primeiro acesso — Super Admin
              </div>
            )}
            {accessMode === "invite" && (
              <div className="mb-3 flex items-center gap-2 bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-full text-xs font-bold">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Convite válido
              </div>
            )}
            {accessMode === "key_entry" && (
              <div className="mb-3 flex items-center gap-2 bg-violet-500/10 text-violet-400 px-3 py-1.5 rounded-full text-xs font-bold">
                <Key className="h-3.5 w-3.5" />
                Licença OEM
              </div>
            )}

            <h1 className="text-white text-2xl font-black font-headline tracking-tight mb-1">
              {accessMode === "first_user" ? "Criar conta principal" : "Criar sua conta"}
            </h1>
            <p className="text-slate-400 text-sm font-medium">
              {accessMode === "first_user"
                ? "Você será o administrador do sistema"
                : accessMode === "invite"
                ? "Você foi convidado para o Alexis CRM"
                : "Insira sua chave de licença para continuar"}
            </p>
          </div>

          <form onSubmit={handleCadastro} className="space-y-4" style={{ transform: "translateZ(20px)" }}>
            {erro && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {erro}
              </div>
            )}

            {/* Chave de Licença — só no modo key_entry */}
            {accessMode === "key_entry" && (
              <div className="space-y-2">
                <Label className="block text-slate-300 text-xs font-bold uppercase tracking-wider ml-1">
                  Chave de Licença OEM
                </Label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary transition-colors">
                    <Key className="size-4" />
                  </div>
                  <Input
                    className="block w-full pl-10 pr-10 py-3 bg-[#090D16]/50 border border-white/10 rounded-lg text-white placeholder-slate-600 font-mono text-sm transition-all focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary focus:outline-none tracking-widest"
                    placeholder="ALEXIS-XXXX-XXXX-XXXX-XXXX"
                    value={licenseKey}
                    onChange={(e) => handleKeyInput(e.target.value)}
                    maxLength={27}
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    {keyChecking && <Loader2 className="size-4 animate-spin text-slate-500" />}
                    {!keyChecking && keyValida === true && <CheckCircle2 className="size-4 text-green-400" />}
                    {!keyChecking && keyValida === false && <XCircle className="size-4 text-red-400" />}
                  </div>
                </div>
                {keyErro && <p className="text-xs text-red-400 ml-1">{keyErro}</p>}
                {keyValida && <p className="text-xs text-green-400 ml-1">Chave válida! Preencha os dados abaixo.</p>}
              </div>
            )}

            {/* Nome */}
            <div className="space-y-2">
              <Label className="block text-slate-300 text-xs font-bold uppercase tracking-wider ml-1" htmlFor="nome">
                Nome Completo
              </Label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary transition-colors">
                  <User className="size-4" />
                </div>
                <Input
                  className="block w-full pl-10 pr-4 py-3 bg-[#090D16]/50 border border-white/10 rounded-lg text-white placeholder-slate-600 font-body text-sm transition-all focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary focus:outline-none"
                  id="nome" type="text" placeholder="Seu nome completo"
                  value={nome} onChange={(e) => setNome(e.target.value)} required
                />
              </div>
            </div>

            {/* E-mail */}
            <div className="space-y-2">
              <Label className="block text-slate-300 text-xs font-bold uppercase tracking-wider ml-1" htmlFor="email">
                E-mail
              </Label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary transition-colors">
                  <Mail className="size-4" />
                </div>
                <Input
                  className="block w-full pl-10 pr-4 py-3 bg-[#090D16]/50 border border-white/10 rounded-lg text-white placeholder-slate-600 font-body text-sm transition-all focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                  id="email" type="email" placeholder="seu@email.com"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  required disabled={!!inviteEmail}
                />
              </div>
            </div>

            {/* Senha */}
            <div className="space-y-2">
              <Label className="block text-slate-300 text-xs font-bold uppercase tracking-wider ml-1" htmlFor="senha">
                Senha
              </Label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary transition-colors">
                  <Lock className="size-4" />
                </div>
                <Input
                  className="block w-full pl-10 pr-12 py-3 bg-[#090D16]/50 border border-white/10 rounded-lg text-white placeholder-slate-600 font-body text-sm transition-all focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary focus:outline-none"
                  id="senha" type={mostrarSenha ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={senha} onChange={(e) => setSenha(e.target.value)} required
                />
                <button className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors" type="button" onClick={() => setMostrarSenha(!mostrarSenha)}>
                  {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Confirmar senha */}
            <div className="space-y-2">
              <Label className="block text-slate-300 text-xs font-bold uppercase tracking-wider ml-1" htmlFor="confirmarSenha">
                Confirmar Senha
              </Label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary transition-colors">
                  <Lock className="size-4" />
                </div>
                <Input
                  className="block w-full pl-10 pr-4 py-3 bg-[#090D16]/50 border border-white/10 rounded-lg text-white placeholder-slate-600 font-body text-sm transition-all focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary focus:outline-none"
                  id="confirmarSenha" type={mostrarSenha ? "text" : "password"}
                  placeholder="Repita a senha"
                  value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={carregando || (accessMode === "key_entry" && !keyValida)}
              className="w-full py-3.5 px-4 bg-primary hover:bg-primary/90 text-[#090D16] font-black text-xs uppercase tracking-widest rounded-lg shadow-lg shadow-primary/20 transform active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 mt-1"
            >
              {carregando
                ? <><Loader2 className="size-4 animate-spin" /> Criando conta...</>
                : <>{accessMode === "first_user" ? "Criar conta e entrar" : "Criar minha conta"} <ArrowRight className="size-4 ml-1" /></>
              }
            </Button>
          </form>

          <div className="mt-5 text-center" style={{ transform: "translateZ(10px)" }}>
            <p className="text-slate-400 text-sm">
              Já tem uma conta?{" "}
              <Link className="text-primary font-bold hover:underline transition-all" href="/login">Entrar</Link>
            </p>
          </div>
        </div>

        <div className="absolute -top-6 -right-6 w-24 h-24 glass rounded-full opacity-50 blur-sm pointer-events-none hidden md:block z-0" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 glass rounded-full opacity-30 blur-md pointer-events-none hidden md:block z-0" />
      </main>

      <footer className="text-center pointer-events-none opacity-40 mt-8 z-10">
        <p className="text-xs text-slate-500 font-medium tracking-widest uppercase">
          Alexis CRM • High Performance WA Solutions
        </p>
      </footer>
    </div>
  );
}
