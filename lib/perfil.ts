/**
 * Foto do perfil por data (`profile.avatarPorData`). Função pura: quem chama passa o relógio,
 * como em `blocosAtivos`, para servir à página, ao cálculo do revalidate e aos testes.
 */
import { dentroDaJanela, FUSO_PADRAO, type Janela } from "./janela";

type PerfilComFotos = { avatar: string; avatarPorData?: readonly { avatar: string; visivel?: Janela }[] };

/** A primeira foto cuja janela inclui `agora`; sem nenhuma, a foto de sempre. */
export function avatarNaData(profile: PerfilComFotos, agora: Date, tz: string = FUSO_PADRAO): string {
  const foto = profile.avatarPorData?.find((f) => (f.visivel?.de || f.visivel?.ate) && dentroDaJanela(f.visivel, agora, tz));
  return foto?.avatar ?? profile.avatar;
}

/** Tudo o que tem janela na config (blocos e fotos do perfil): a página é refeita na próxima fronteira. */
export function janelasDaConfig(config: {
  blocks: readonly { visivel?: Janela }[];
  profile: { avatarPorData?: readonly { visivel?: Janela }[] };
}): { visivel?: Janela }[] {
  return [...config.blocks, ...(config.profile.avatarPorData ?? [])];
}
