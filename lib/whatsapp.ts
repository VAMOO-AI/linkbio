/**
 * Monta o link de WhatsApp: wa.me/<numero>?text=<texto>.
 * O número vem da config (só dígitos, com DDI); o texto vem do bloco/oferta.
 */
export function linkWhatsApp(numero: string, texto: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/** Destino de WhatsApp, para o pixel marcar o clique mesmo quando o href passa por /r/. */
export function ehLinkWhatsapp(url: string): boolean {
  return /wa\.me|api\.whatsapp\.com|whatsapp\.com\/send/i.test(url);
}
