import type { CSSProperties, ReactNode } from "react";
import { alvoRede, hrefDoClique } from "@/lib/cliques";

type Icone = "instagram" | "tiktok" | "youtube" | "whatsapp" | "linkedin" | "facebook" | "x" | "site";

const ICONES: Record<Icone, { forma: ReactNode; rotulo: string }> = {
  instagram: {
    rotulo: "Instagram",
    forma: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  tiktok: {
    rotulo: "TikTok",
    forma: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
        <path d="M16.5 3c.4 2.3 1.9 3.8 4.2 4v3c-1.6 0-3-.5-4.2-1.3v6.6c0 3.9-2.7 6.2-6 6.2-3 0-5.5-2.2-5.5-5.2 0-3.1 2.6-5.3 6-5.1v3.1c-1.6-.3-2.9.8-2.9 2 0 1.1.9 2.1 2.4 2.1 1.6 0 2.6-1 2.6-2.9V3h3.4z" />
      </svg>
    ),
  },
  youtube: {
    rotulo: "YouTube",
    forma: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="2" y="5" width="20" height="14" rx="4" />
        <path d="M10 9.5v5l4.5-2.5z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  whatsapp: {
    rotulo: "WhatsApp",
    forma: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2-5.4A8.5 8.5 0 1 1 21 11.5z" />
      </svg>
    ),
  },
  linkedin: {
    rotulo: "LinkedIn",
    forma: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
        <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V21h-4v-5.5c0-1.3 0-3-1.9-3s-2.2 1.4-2.2 2.9V21H9z" />
      </svg>
    ),
  },
  facebook: {
    rotulo: "Facebook",
    forma: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
        <path d="M14 9h3l-.5 3H14v9h-3.5v-9H8V9h2.5V7c0-2.5 1.5-4 4-4H17v3h-1.8c-1 0-1.2.5-1.2 1.2V9z" />
      </svg>
    ),
  },
  x: {
    rotulo: "X",
    forma: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
        <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L6.4 22H3.2l7.3-8.3L1.6 2H8l4.4 5.9L18.9 2zm-1.1 17.8h1.7L6.6 3.8H4.7l13.1 16z" />
      </svg>
    ),
  },
  site: {
    rotulo: "Site",
    forma: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.5 3.8 5.6 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.6-3.8-9S9.5 5.5 12 3z" />
      </svg>
    ),
  },
};

export function IconeSocial({ icone, style }: { icone: Icone; style?: CSSProperties }) {
  const entrada = ICONES[icone] ?? ICONES.site;
  return (
    <span className="icone-social" style={style} aria-hidden="true">
      {entrada.forma}
    </span>
  );
}

export function SocialBlock({
  items,
  chave = null,
}: {
  items: { icone: Icone; rotulo: string; url: string }[];
  chave?: string | null;
}) {
  return (
    <nav className="bloco-social" aria-label="Redes sociais">
      {items.map((item, i) => (
        <a key={`${item.icone}-${item.url}`} href={hrefDoClique(chave ? alvoRede(chave, i) : null, item.url)} target="_blank" rel="noopener" aria-label={item.rotulo} title={item.rotulo}>
          <IconeSocial icone={item.icone} />
        </a>
      ))}
    </nav>
  );
}
