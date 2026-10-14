import type { NextConfig } from "next";

/** Imagens enviadas pelo /admin ficam no Storage do Supabase: libera só esse host no next/image. */
const supabase = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL) : null;

const nextConfig: NextConfig = {
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
