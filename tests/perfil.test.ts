import { describe, expect, test } from "vitest";
import { avatarNaData, janelasDaConfig } from "../lib/perfil";
import { segundosAteProximaFronteira } from "../lib/janela";

const perfil = {
  avatar: "/avatar.jpg",
  avatarPorData: [
    { avatar: "/black.jpg", visivel: { de: "2026-11-11", ate: "2026-11-11" } },
    { avatar: "/novembro.jpg", visivel: { de: "2026-11-01", ate: "2026-11-30" } },
  ],
};
const tz = "America/Sao_Paulo";

describe("foto do perfil por data", () => {
  test("fora de toda janela vale a foto de sempre", () => {
    expect(avatarNaData(perfil, new Date("2026-10-31T15:00:00Z"), tz)).toBe("/avatar.jpg");
    expect(avatarNaData({ avatar: "/avatar.jpg" }, new Date("2026-11-11T15:00:00Z"), tz)).toBe("/avatar.jpg");
  });

  test("dentro da janela vale a foto dela; janelas sobrepostas: vale a primeira da lista", () => {
    expect(avatarNaData(perfil, new Date("2026-11-05T15:00:00Z"), tz)).toBe("/novembro.jpg");
    expect(avatarNaData(perfil, new Date("2026-11-11T15:00:00Z"), tz)).toBe("/black.jpg");
  });

  test("a troca da foto também encurta o tempo até a página ser refeita", () => {
    const config = { blocks: [{ type: "profile" }], profile: perfil };
    const agora = new Date("2026-10-31T23:00:00Z"); // 20:00 em São Paulo
    // Próxima fronteira: 01/11 00:00 em São Paulo = 03:00 UTC, 4 horas depois.
    expect(segundosAteProximaFronteira(janelasDaConfig(config), agora, tz)).toBe(4 * 3600);
  });
});
