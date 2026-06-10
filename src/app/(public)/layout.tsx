import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Alexis CRM — Planos e Licenças",
  description: "CRM completo para WhatsApp. Gerencie contatos, leads, vendas e automações.",
};

export default function PublicLayout({ children }: { children: ReactNode }) {
  return children;
}
