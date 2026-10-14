import Image from "next/image";
import type { ChaveDe } from "@/config/opcoes";
import type { LinkbioConfig } from "@/config/schema";
import { alvoPerfil, hrefDoClique } from "@/lib/cliques";
import { IconeSocial } from "./social";

type Props = {
  header: ChaveDe<"header">;
  socials: ChaveDe<"socials">;
  cover?: string;
  profile: LinkbioConfig["profile"];
  chave?: string | null;
};

export function ProfileBlock({ header, socials, cover, profile, chave = null }: Props) {
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
        src={profile.avatar}
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
          {profile.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}
      {redes.length > 0 && (
        <nav className="perfil-redes" aria-label="Redes sociais">
          {redes.map((r, i) =>
            socials === "nomes" ? (
              // Nome acessível = texto visível (WCAG 2.5.3).
              <a key={`${r.icone}-${r.url}`} href={hrefDoClique(chave ? alvoPerfil(i) : null, r.url)} target="_blank" rel="noopener">
                <IconeSocial icone={r.icone} />
                <span>{r.rotulo}</span>
              </a>
            ) : (
              <a
                key={`${r.icone}-${r.url}`}
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
    </header>
  );
}
