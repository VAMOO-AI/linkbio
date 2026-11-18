import { describe, expect, test } from "vitest";
import { dataCurta, lerCanal, videosDo, type VideoDoCanal } from "../lib/youtube";
import { lerCanalDaEntrada, lerFeed } from "../scripts/youtube";

const video = (id: string, extra: Partial<VideoDoCanal> = {}): VideoDoCanal => ({
  id,
  titulo: `Vídeo ${id}`,
  publicado: "2026-11-10",
  url: `https://www.youtube.com/watch?v=${id}`,
  imagem: `/youtube/${id}.webp`,
  short: false,
  ...extra,
});

describe("vídeos do canal (public/youtube/videos.json)", () => {
  const dados = lerCanal({
    canal: "Canal",
    coletadoEm: "2026-11-18",
    videos: [video("AAAAAAAAAA1"), video("SSSSSSSSSS1", { short: true, url: "https://www.youtube.com/shorts/SSSSSSSSSS1" }), video("BBBBBBBBBB2")],
  });

  test("sem shorts, devolve só os vídeos do @ pedido, até o limite", () => {
    expect(videosDo("@canal", 6, false, dados).map((v) => v.id)).toEqual(["AAAAAAAAAA1", "BBBBBBBBBB2"]);
    expect(videosDo("@canal", 1, false, dados)).toHaveLength(1);
  });

  test("com shorts, os Shorts entram na ordem do feed", () => {
    expect(videosDo("@canal", 6, true, dados).map((v) => v.id)).toEqual(["AAAAAAAAAA1", "SSSSSSSSSS1", "BBBBBBBBBB2"]);
  });

  test("outro canal no arquivo não aparece como seu", () => {
    expect(videosDo("@outro", 6, true, dados)).toEqual([]);
  });

  test("descarta vídeo malformado em vez de quebrar a página", () => {
    const sujo = lerCanal({
      canal: "canal",
      videos: [video("OKOKOKOKOK1"), video("curto"), video("XXXXXXXXXX1", { url: "https://evil.com/v" }), video("YYYYYYYYYY1", { imagem: "https://i.ytimg.com/x.jpg" }), null],
    });
    expect(sujo.videos.map((v) => v.id)).toEqual(["OKOKOKOKOK1"]);
    expect(lerCanal("lixo").videos).toEqual([]);
  });

  test("data curta em português", () => {
    expect(dataCurta("2026-11-10")).toBe("10 nov 2026");
    expect(dataCurta("lixo")).toBe("");
  });
});

describe("npm run youtube: canal e feed", () => {
  test("aceita @canal, canal e o link do canal", () => {
    expect(lerCanalDaEntrada("@canal.exemplo")).toBe("canal.exemplo");
    expect(lerCanalDaEntrada("https://www.youtube.com/@canal-x/")).toBe("canal-x");
    expect(() => lerCanalDaEntrada("https://exemplo.com/x y")).toThrow(/não parece um canal/);
  });

  test("lê o feed Atom, separa Shorts e desescapa o título", () => {
    const xml = `<feed>
      <entry><yt:videoId>f5OHcYMEWBQ</yt:videoId><title>ANTES &amp; DEPOIS</title>
        <link rel="alternate" href="https://www.youtube.com/watch?v=f5OHcYMEWBQ"/><published>2026-11-10T12:00:00+00:00</published></entry>
      <entry><yt:videoId>wZp4KkdLrus</yt:videoId><title>Short</title>
        <link rel="alternate" href="https://www.youtube.com/shorts/wZp4KkdLrus"/><published>2026-11-17T12:00:00+00:00</published></entry>
      <entry><title>sem id</title></entry>
    </feed>`;
    expect(lerFeed(xml)).toEqual([
      { id: "f5OHcYMEWBQ", titulo: "ANTES & DEPOIS", publicado: "2026-11-10", url: "https://www.youtube.com/watch?v=f5OHcYMEWBQ", short: false },
      { id: "wZp4KkdLrus", titulo: "Short", publicado: "2026-11-17", url: "https://www.youtube.com/shorts/wZp4KkdLrus", short: true },
    ]);
  });
});
