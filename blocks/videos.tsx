import Image from "next/image";
import { dataCurta, videosDo } from "@/lib/youtube";
import { IconeSocial } from "./social";

type Props = { title?: string; canal: string; limit: number; shorts: boolean };

export function VideosBlock({ title, canal, limit, shorts }: Props) {
  const videos = videosDo(canal, limit, shorts);
  // Sem vídeos coletados deste canal, o bloco some em vez de deixar um título solto.
  if (videos.length === 0) return null;
  const nome = canal.replace(/^@+/, "");
  const pagina = `https://www.youtube.com/@${nome}`;

  return (
    <section className="bloco-videos" aria-label={title ?? `YouTube @${nome}`}>
      <div className="videos-topo">
        <div>
          <p className="videos-eyebrow">
            <IconeSocial icone="youtube" />
            @{nome}
          </p>
          <h2 className="videos-titulo">{title ?? "Últimos vídeos"}</h2>
        </div>
        <a className="videos-inscrever" href={`${pagina}?sub_confirmation=1`} target="_blank" rel="noopener">
          Inscrever-se
        </a>
      </div>
      <ul className={videos.length === 1 ? "videos-lista videos-um" : "videos-lista"}>
        {videos.map((v) => (
          <li key={v.id}>
            <a href={v.url} target="_blank" rel="noopener" className="video-card">
              <span className="video-capa">
                <Image src={v.imagem} alt="" width={640} height={360} sizes="(max-width: 560px) 80vw, 400px" />
                <span className="video-play" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M8 5.5v13l11-6.5z" />
                  </svg>
                </span>
              </span>
              <span className="video-nome">{v.titulo}</span>
              <span className="video-data">{dataCurta(v.publicado)}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
