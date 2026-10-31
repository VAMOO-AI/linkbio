import type { NextConfig } from "next";
import { lerSupabase } from "./lib/supabase-chave";

/** Imagens enviadas pelo /admin ficam no Storage do Supabase: libera só esse host no next/image. */
const supabaseUrl = lerSupabase(process.env)?.url;
const supabase = supabaseUrl ? new URL(supabaseUrl) : null;

/**
 * Cabeçalhos de segurança em toda rota. `frame-ancestors 'self'`: só o próprio site abre a página
 * num iframe (a prévia do /admin), outro site não (clickjacking). CSP completa fica de fora: teria
 * de listar Meta, GA4, Clarity, Supabase e Google, e um esquecimento derruba a medição.
 */
const CABECALHOS_SEGURANCA = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), usb=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:caminho*", headers: CABECALHOS_SEGURANCA }];
  },
  experimental: {
    serverActions: {
      // Upload de imagem do painel é Server Action (padrão do Next: 1 MB). 4 MB de arquivo
      // (lib/admin/limites.ts) + folga do multipart, abaixo do corte de 4,5 MB da Vercel.
      bodySizeLimit: "4.2mb",
    },
  },
  // A capa ao compartilhar (/capa.jpg) é refeita no servidor quando o /admin publica: precisa das
  // fontes e das imagens de public/ (foto, capa própria) dentro da função, não só no CDN.
  outputFileTracingIncludes: {
    "/capa.jpg": ["./assets/fonts/**/*", "./public/**/*.{jpg,jpeg,png,webp,gif,svg}"],
    // O layout lê o CSS do next/font para pré-carregar só a família em uso.
    "/": ["./.next/static/**/*.css"],
    "/admin-previa": ["./.next/static/**/*.css"],
    "/e2e/fonte/[modelo]": ["./.next/static/**/*.css"],
  },
  images: {
    remotePatterns: supabase
      ? [{ protocol: "https", hostname: supabase.hostname, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
};

export default nextConfig;
