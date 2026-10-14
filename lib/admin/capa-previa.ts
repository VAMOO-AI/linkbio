import "server-only";
import { ProfileSchema, ShareSchema, ThemeSchema, type LinkbioConfig } from "@/config/schema";
import { gerarCapa } from "@/lib/capa";
import { enderecoBase, linkComPreviaNova, versaoDaCapa, type Encaixe } from "@/lib/compartilhar";
import { lerPublicada } from "./dados";

export type PreviaDaCapa =
  | {
      ok: true;
      /** A capa como o /capa.jpg vai sair (JPG em data URL). */
      imagem: string;
      origem: "propria" | "automatica";
      encaixe: Encaixe | null;
      largura: number | null;
      altura: number | null;
      /** Domínio que o WhatsApp mostra embaixo do texto. */
      dominio: string;
      /** Link da bio com o final da capa que está NO AR (o que mandar para ver a prévia nova). */
      linkNovo: string;
      /** A capa do rascunho é diferente da que está no ar: falta publicar. */
      faltaPublicar: boolean;
      /** A capa ao compartilhar do rascunho passou no schema (senão o próprio campo já mostra o erro). */
      shareValido: boolean;
    }
  | { ok: false };

const ehObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Capa do rascunho para a prévia do painel ("Assim aparece no WhatsApp"), gerada pelo mesmo código do
 * /capa.jpg. Só lê do rascunho o que aparece na capa (perfil, aparência, site.share); a parte que
 * estiver inválida enquanto a pessoa digita vale a publicada. Imagem só de public/ ou do Storage
 * (lib/capa.tsx, lerImagem): o painel não vira um baixador de qualquer endereço.
 */
export async function previaDaCapa(rascunho: unknown): Promise<PreviaDaCapa> {
  const { config: noAr } = await lerPublicada();
  const r = ehObj(rascunho) ? rascunho : {};
  const site = ehObj(r.site) ? r.site : {};
  const perfil = ProfileSchema.safeParse(r.profile);
  const tema = ThemeSchema.safeParse(r.theme ?? {});
  const share = site.share === undefined ? null : ShareSchema.safeParse(site.share);
  const montar = (theme: LinkbioConfig["theme"]): LinkbioConfig => ({
    ...noAr,
    profile: perfil.success ? perfil.data : noAr.profile,
    theme,
    site: { ...noAr.site, share: share === null ? undefined : share.success ? share.data : noAr.site.share },
  });
  let config = montar(tema.success ? tema.data : noAr.theme);
  let capa;
  try {
    capa = await gerarCapa(config);
  } catch {
    // Aparência que só o schema inteiro recusa (ex.: modo escuro num modelo só claro): vale a do ar.
    try {
      config = montar(noAr.theme);
      capa = await gerarCapa(config);
    } catch (erro) {
      console.error("[linkbio admin] prévia da capa", erro);
      return { ok: false };
    }
  }
  const base = enderecoBase(noAr.site.url, process.env);
  return {
    ok: true,
    imagem: `data:image/jpeg;base64,${capa.corpo.toString("base64")}`,
    origem: capa.origem,
    encaixe: capa.encaixe ?? null,
    largura: capa.largura ?? null,
    altura: capa.altura ?? null,
    dominio: base.hostname,
    linkNovo: linkComPreviaNova(base.toString(), versaoDaCapa(noAr)),
    faltaPublicar: versaoDaCapa(config) !== versaoDaCapa(noAr),
    shareValido: share === null || share.success,
  };
}
