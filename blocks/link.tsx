import Image from "next/image";
import { alvoLink, hrefDoClique } from "@/lib/cliques";
import { IconeSocial } from "./social";

type Icone = "instagram" | "tiktok" | "youtube" | "whatsapp" | "linkedin" | "facebook" | "x" | "site";

type Props = { title: string; url: string; icon?: Icone; subtitle?: string; image?: string; chave?: string | null };

export function LinkBlock({ title, url, icon, subtitle, image, chave = null }: Props) {
  // Com imagem ou subtítulo o link vira card (miniatura + texto); sem, continua botão.
  const card = Boolean(image || subtitle);
  return (
    <a className="bloco-link" data-card={card || undefined} href={hrefDoClique(chave ? alvoLink(chave) : null, url)} target="_blank" rel="noopener">
      {image ? (
        <Image className="link-imagem" src={image} alt="" width={58} height={74} />
      ) : (
        icon && <IconeSocial icone={icon} />
      )}
      {card ? (
        <span className="link-texto">
          <span className="link-titulo">{title}</span>
          {subtitle && <span className="link-sub">{subtitle}</span>}
        </span>
      ) : (
        <span>{title}</span>
      )}
      {card && (
        <span className="link-seta" aria-hidden="true">
          ›
        </span>
      )}
    </a>
  );
}
