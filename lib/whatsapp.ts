/**
 * Monta o link de WhatsApp: wa.me/<numero>?text=<texto>.
 * O número vem da config (só dígitos, com DDI); o texto vem do bloco/oferta.
 */
export function linkWhatsApp(numero: string, texto: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
