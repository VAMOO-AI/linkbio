import { renderSVG } from "uqr";

/**
 * QR em SVG, só no servidor. A lib `uqr` (cerca de 27 KB, sem dependência)
 * não entra no JavaScript da página: quem desenha o Pix é um componente de servidor.
 * Correção M e margem de 4 módulos, para o app do banco conseguir ler.
 */
export function qrSvg(texto: string): string {
  return renderSVG(texto, { ecc: "M", border: 4, pixelSize: 4 });
}
