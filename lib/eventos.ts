/**
 * Eventos que a bio dispara para o Pixel, o GA4 e o Clarity. Quem escuta é o script do aviso de cookies
 * (lib/aviso-cookies.ts): sem pixel ou sem aceite, o evento simplesmente não tem ouvinte.
 * Fica separado do aviso para o componente do navegador não levar o texto do script junto.
 */
export const EVENTOS_DA_BIO = ["Lead", "Contact"] as const;
export type EventoDaBio = { nome: (typeof EVENTOS_DA_BIO)[number]; id?: string; metodo?: string };

export function dispararEvento(evento: EventoDaBio): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(new CustomEvent("linkbio:evento", { detail: evento }));
}
