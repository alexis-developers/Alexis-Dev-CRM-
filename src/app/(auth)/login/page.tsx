"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlexisLogo } from "@/components/ui/alexis-logo";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);

  // Parallax 3D Card Tilt Effect on mouse movement
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const handleMouseMove = (e: MouseEvent) => {
      const xAxis = (window.innerWidth / 2 - e.pageX) / 45;
      const yAxis = (window.innerHeight / 2 - e.pageY) / 45;
      card.style.transform = `perspective(1000px) rotateY(${xAxis}deg) rotateX(${yAxis}deg)`;
      card.style.transition = "none";
    };

    const handleMouseLeave = () => {
      card.style.transform = "perspective(1000px) rotateY(0deg) rotateX(0deg)";
      card.style.transition = "transform 0.5s ease-out";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await authClient.signIn.email({ email, password });

    if (result.error) {
      setError(result.error.message ?? "Email ou senha incorretos.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <div className="bg-gradient-mesh min-h-screen w-full flex items-center justify-center p-4 flex-col overflow-hidden relative">
      {/* Background Decorative Accents */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-secondary/5 blur-[120px] rounded-full" />
      </div>

      {/* Login Container */}
      <main className="relative w-full max-w-[440px] z-10">
        {/* Glass Login Card with 3D Tilt Ref */}
        <div
          ref={cardRef}
          className="glass rounded-xl p-8 md:p-10 shadow-2xl transition-all duration-500 transform-gpu"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Header Section */}
          <div className="flex flex-col items-center mb-10 text-center" style={{ transform: "translateZ(30px)" }}>
            <div className="mb-6 floating">
              <AlexisLogo className="h-12 w-auto object-contain" />
            </div>
            <h1 className="text-white text-2xl font-black font-headline tracking-tight mb-2">
              Bem-vindo de volta
            </h1>
            <p className="text-slate-400 text-sm font-medium">
              Acesse o seu painel do Alexis WA-CRM
            </p>
          </div>

          {/* Login Form */}
          <form
            onSubmit={handleLogin}
            className="space-y-6"
            style={{ transform: "translateZ(20px)" }}
          >
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <Label
                className="block text-slate-300 text-xs font-bold uppercase tracking-wider ml-1"
                htmlFor="email"
              >
                Endereço de E-mail
              </Label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary transition-colors">
                  <Mail className="size-4" />
                </div>
                <Input
                  className="block w-full pl-10 pr-4 py-3 bg-[#090D16]/50 border border-white/10 rounded-lg text-white placeholder-slate-600 font-body text-sm transition-all focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary focus:outline-none"
                  id="email"
                  name="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  type="email"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <Label
                  className="block text-slate-300 text-xs font-bold uppercase tracking-wider"
                  htmlFor="password"
                >
                  Senha
                </Label>
                <Link
                  className="text-primary hover:text-primary/80 text-xs font-semibold transition-colors"
                  href="/forgot-password"
                >
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary transition-colors">
                  <Lock className="size-4" />
                </div>
                <Input
                  className="block w-full pl-10 pr-12 py-3 bg-[#090D16]/50 border border-white/10 rounded-lg text-white placeholder-slate-600 font-body text-sm transition-all focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary focus:outline-none"
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  type={showPassword ? "text" : "password"}
                />
                <button
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Sign In Button */}
            <Button
              className="w-full py-3.5 px-4 bg-primary hover:bg-primary/90 text-[#090D16] font-black text-xs uppercase tracking-widest rounded-lg shadow-lg shadow-primary/20 transform active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
              type="submit"
              disabled={loading}
            >
              {loading ? "Entrando..." : "Entrar"}
              <ArrowRight className="size-4 ml-1" />
            </Button>
          </form>

          {/* Footer Links */}
          <div className="mt-8 text-center space-y-3" style={{ transform: "translateZ(10px)" }}>
            <p className="text-slate-400 text-sm">
              Não tem uma conta?{" "}
              <Link
                className="text-primary font-bold hover:underline transition-all"
                href="/planos"
              >
                Comprar licença
              </Link>
            </p>
            <div className="border-t border-white/5 pt-3">
              <p className="text-slate-500 text-xs">
                Licença expirada?{" "}
                <Link
                  className="text-amber-400 font-semibold hover:underline transition-all"
                  href="/checkout?renewal=1"
                >
                  Renovar agora
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Decorative Floating Accents */}
        <div className="absolute -top-6 -right-6 w-24 h-24 glass rounded-full opacity-50 blur-sm pointer-events-none hidden md:block z-0" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 glass rounded-full opacity-30 blur-md pointer-events-none hidden md:block z-0" />
      </main>

      {/* Footer Copyright */}
      <footer className="text-center pointer-events-none opacity-40 mt-8 z-10">
        <p className="text-xs text-slate-500 font-medium tracking-widest uppercase">
          Alexis CRM • High Performance WA Solutions
        </p>
      </footer>
    </div>
  );
}
