"use client";

import { useEffect, useState } from "react";
import { RenewalModal } from "./renewal-modal";

interface LicenseStatus {
  status: string;
  expired: boolean;
  expiresAt?: string;
  daysLeft?: number;
  isSuperAdmin?: boolean;
  email?: string;
}

// Wraps dashboard — shows renewal modal if license expired
export function LicenseGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<LicenseStatus | null>(null);

  useEffect(() => {
    fetch("/api/license-status")
      .then((r) => r.json())
      .then((data) => setStatus(data))
      .catch(() => setStatus({ status: "error", expired: false }));
  }, []);

  // Show children while loading (avoid flash)
  if (!status) return <>{children}</>;

  if (status.expired) {
    return <RenewalModal email={status.email} expiresAt={status.expiresAt} />;
  }

  return (
    <>
      {children}
      {/* Warning banner when ≤ 30 days remaining */}
      {!status.expired && (status.daysLeft ?? 999) <= 30 && (status.daysLeft ?? 0) > 0 && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-amber-500/30 bg-amber-500/10 backdrop-blur px-4 py-3 text-sm text-amber-300 shadow-lg">
          <p className="font-bold mb-0.5">⚠ Licença expirando em {status.daysLeft} dia(s)</p>
          <p className="text-xs text-amber-400/70">
            Renove para não perder o acesso. Contate o administrador.
          </p>
        </div>
      )}
    </>
  );
}
