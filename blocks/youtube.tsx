"use client";

import { useState } from "react";

export function YoutubeBlock({ title, videoId, poster }: { title?: string; videoId: string; poster?: string }) {
  // Fachada: capa + play, sem iframe até o clique (privacidade + performance).
  const [tocando, setTocando] = useState(false);
  const capa = poster ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  return (
    <section className="bloco-youtube" aria-label={title ?? "Vídeo"}>
      {title && <h2 className="youtube-titulo">{title}</h2>}
      {tocando ? (
        <iframe
          className="youtube-player"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          title={title ?? "Vídeo do YouTube"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          className="youtube-fachada"
          onClick={() => setTocando(true)}
          aria-label={`Assistir: ${title ?? "vídeo"}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={capa} alt="" loading="lazy" />
          <span className="youtube-play" aria-hidden="true">
            ▶
          </span>
        </button>
      )}
    </section>
  );
}
