import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "Painel da bio",
  robots: { index: false, follow: false },
};

/** Layout próprio do /admin: sem o tema da bio pública. `adm-raiz` carrega os tokens de cor (claro e escuro, ver admin.css). */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="adm-raiz">
      <body className="adm">{children}</body>
    </html>
  );
}
