import { beforeEach, describe, expect, test, vi } from "vitest";

/** POST /api/visita: a origem conta sempre; o site vai numa chamada à parte (banco sem a 0011 segue contando). */

const chamadas: { caminho: string; corpo: Record<string, unknown> }[] = [];
let semTabelaDeSites = false;

vi.mock("server-only", () => ({}));
vi.mock("../lib/supabase", () => ({
  supabaseConfigurado: () => true,
  rest: async (caminho: string, init: { body?: string }) => {
    chamadas.push({ caminho, corpo: JSON.parse(init.body ?? "{}") as Record<string, unknown> });
    if (semTabelaDeSites && caminho === "rpc/registrar_site_visita") throw new Error("Supabase 404 em rpc/registrar_site_visita: PGRST202");
    return null;
  },
}));
vi.mock("../lib/config-fonte", () => ({
  obterConfig: async () => ({ site: { url: "https://bio.exemplo.com", tz: "America/Sao_Paulo" }, features: { analytics: true } }),
}));

const { POST } = await import("../app/api/visita/route");

function pedido(corpo: unknown): Request {
  return new Request("https://bio.exemplo.com/api/visita", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0 (iPhone)" },
    body: JSON.stringify(corpo),
  });
}

beforeEach(() => {
  chamadas.length = 0;
  semTabelaDeSites = false;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("visita com o site de onde veio", () => {
  test("conta a origem e o domínio, em chamadas separadas", async () => {
    const r = await POST(pedido({ origem: "direto", site: "www.Blog.Qualquer.com" }));
    expect(r.status).toBe(204);
    expect(chamadas.map((c) => c.caminho)).toEqual(["rpc/registrar_visita", "rpc/registrar_site_visita"]);
    expect(chamadas[1]!.corpo).toMatchObject({ p_site: "blog.qualquer.com" });
  });

  test("o próprio site, lixo ou sem site: só a origem", async () => {
    for (const site of ["bio.exemplo.com", "<x>", undefined, 42]) {
      chamadas.length = 0;
      await POST(pedido({ origem: "bio", site }));
      expect(chamadas.map((c) => c.caminho), String(site)).toEqual(["rpc/registrar_visita"]);
    }
  });

  test("banco sem a 0011: a visita continua contada e a resposta é 204", async () => {
    semTabelaDeSites = true;
    const r = await POST(pedido({ origem: "direto", site: "blog.qualquer.com" }));
    expect(r.status).toBe(204);
    expect(chamadas[0]!.caminho).toBe("rpc/registrar_visita");
  });
});
