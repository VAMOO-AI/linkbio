import Image from "next/image";
import type { ChaveDe } from "@/config/opcoes";
import type { LinkbioConfig } from "@/config/schema";
import { alvoPerfil, hrefDoClique } from "@/lib/cliques";
import { AcoesCompartilhar } from "./compartilhar";
import { IconeSocial } from "./social";

type Props = {
  header: ChaveDe<"header">;
  socials: ChaveDe<"socials">;
  cover?: string;
  profile: LinkbioConfig["profile"];
  chave?: string | null;
  /** Foto do dia (profile.avatarPorData); sem ela, profile.avatar. */
  avatar?: string;
  /** Painel "Compartilhar": link da bio e o QR já desenhado no servidor (lib/qr.ts). */
  compartilhar?: { url: string; qrUrl: string; svg: string } | null;
};

export function ProfileBlock({ header, socials, cover, profile, chave = null, avatar, compartilhar = null }: Props) {
  const redes = socials === "oculto" ? [] : (profile.socials ?? []);
  return (
    <header className="bloco-perfil" data-header={header} data-socials={socials}>
      {header === "capa" && (
        <div className="perfil-capa" aria-hidden="true">
          {cover && (
            <Image src={cover} alt="" fill sizes="(max-width: 560px) 100vw, 560px" loading="eager" fetchPriority="high" />
          )}
        </div>
      )}
      <Image
        src={avatar ?? profile.avatar}
        alt={`Foto de ${profile.name}`}
        width={96}
        height={96}
        loading="eager"
        fetchPriority="high"
        className="perfil-avatar"
      />
      <div className="perfil-texto">
        <h1 className="perfil-nome">{profile.name}</h1>
        <p className="perfil-handle">{profile.handle}</p>
        <p className="perfil-bio">{profile.bio}</p>
      </div>
      {profile.tags.length > 0 && (
        <ul className="perfil-tags" aria-label="Temas">
          {profile.tags.map((tag, i) => (
            <li key={`${i}-${tag}`}>{tag}</li>
          ))}
        </ul>
      )}
      {redes.length > 0 && (
        <nav className="perfil-redes" aria-label="Redes sociais">
          {redes.map((r, i) =>
            socials === "nomes" ? (
              // Nome acessível = texto visível (WCAG 2.5.3).
              <a key={`${i}-${r.icone}-${r.url}`} href={hrefDoClique(chave ? alvoPerfil(i) : null, r.url)} target="_blank" rel="noopener">
                <IconeSocial icone={r.icone} />
                <span>{r.rotulo}</span>
              </a>
            ) : (
              <a
                key={`${i}-${r.icone}-${r.url}`}
                href={hrefDoClique(chave ? alvoPerfil(i) : null, r.url)}
                target="_blank"
                rel="noopener"
                aria-label={r.rotulo}
                title={r.rotulo}
              >
                <IconeSocial icone={r.icone} />
              </a>
            ),
          )}
        </nav>
      )}
      {compartilhar && (
        <details className="perfil-compartilhar">
          <summary>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" />
            </svg>
            Compartilhar
          </summary>
          <div className="compartilhar-painel">
            <div className="compartilhar-qr" role="img" aria-label={`QR Code da bio de ${profile.name}`} dangerouslySetInnerHTML={{ __html: compartilhar.svg }} />
            <p className="compartilhar-dica">Aponte a câmera do celular para o código.</p>
            <p className="compartilhar-link" translate="no">
              {compartilhar.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </p>
            <AcoesCompartilhar url={compartilhar.url} titulo={profile.name} />
            <a className="compartilhar-baixar" href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(compartilhar.svg)}`} download="qr-code-bio.svg">
              Baixar QR Code
            </a>
          </div>
        </details>
      )}
    </header>
  );
}
