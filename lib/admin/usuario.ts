/** O que `npm run admin:usuario` entendeu da linha de comando. Sem rede. */
export type PedidoUsuario =
  | { ok: true; email: string; senha: string | null; gerar: boolean }
  | { ok: false; erro: string };

const USO = "Uso: npm run admin:usuario -- <email> [--senha [senha]]";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Sem `--senha`, só cadastra o e-mail. `--senha` sozinho gera uma senha; com valor, usa esse valor. */
export function interpretarPedido(argv: string[]): PedidoUsuario {
  const email = (argv[0] ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, erro: USO };
  const resto = argv.slice(1);
  if (resto.length === 0) return { ok: true, email, senha: null, gerar: false };
  if (resto[0] !== "--senha" || resto.length > 2) return { ok: false, erro: USO };
  const dada = resto[1];
  if (dada) return { ok: true, email, senha: dada, gerar: false };
  return { ok: true, email, senha: null, gerar: true };
}
