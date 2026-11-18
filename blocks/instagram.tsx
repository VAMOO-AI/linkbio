import Image from "next/image";
import { postsDo, textoAlternativo, type PostDoFeed } from "@/lib/instagram";
import { IconeSocial } from "./social";

function IconeTipo({ tipo }: { tipo: PostDoFeed["tipo"] }) {
  if (tipo === "imagem") return null;
  return (
    <span className="insta-tipo" aria-hidden="true">
      {tipo === "video" ? (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <path d="M3 8h18M8.5 3l3 5M14.5 3l3 5" />
          <path d="M10 11.5v5l4.5-2.5z" fill="currentColor" stroke="none" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <rect x="7" y="7" width="14" height="14" rx="3" />
          <path d="M17 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2" />
        </svg>
      )}
    </span>
  );
}

type Props = { title?: string; handle: string; limit: number };

export function InstagramBlock({ title, handle, limit }: Props) {
  const posts = postsDo(handle, limit);
  // Sem posts coletados deste @, o bloco some em vez de deixar um título solto.
  if (posts.length === 0) return null;
  const usuario = handle.replace(/^@+/, "");
  const perfil = `https://www.instagram.com/${usuario}/`;

  return (
    <section className="bloco-instagram" aria-label={title ?? `Instagram @${usuario}`}>
      <div className="insta-topo">
        <div className="insta-cabeca">
          <p className="insta-eyebrow">
            <IconeSocial icone="instagram" />
            @{usuario}
          </p>
          <h2 className="insta-titulo">{title ?? "Últimos posts"}</h2>
        </div>
        <a className="insta-seguir" href={perfil} target="_blank" rel="noopener">
          Seguir
        </a>
      </div>
      <ul className="insta-grade">
        {posts.map((post) => (
          <li key={post.codigo}>
            <a href={post.url} target="_blank" rel="noopener" className="insta-post">
              <Image src={post.imagem} alt={textoAlternativo(post)} width={360} height={480} sizes="(max-width: 560px) 33vw, 180px" />
              <IconeTipo tipo={post.tipo} />
            </a>
          </li>
        ))}
      </ul>
      <a className="insta-mais" href={perfil} target="_blank" rel="noopener">
        Ver tudo no Instagram
      </a>
    </section>
  );
}
