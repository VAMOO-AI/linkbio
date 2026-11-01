import { z } from "zod";

/**
 * zod sem `new Function`. Sem isto, o zod testa `new Function("")` para compilar a validação, e a
 * CSP (lib/seguranca.ts, sem 'unsafe-eval') registra uma violação no painel e no concierge com IA.
 * Importe o `z` daqui, nunca direto de "zod": a configuração vale antes da primeira validação.
 */
z.config({ jitless: true });

export { z };
