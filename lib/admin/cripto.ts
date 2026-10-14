import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Senha e sessão do /admin, sem dependência externa. Funções puras (testadas em tests/admin-cripto.test.ts).
 * Senha: scrypt com sal aleatório. Sessão: e-mail + validade assinados com HMAC-SHA256 (ADMIN_SESSION_SECRET).
 */
const scrypt = promisify(scryptCb) as (senha: string, sal: Buffer, tam: number, opts: object) => Promise<Buffer>;
const N = 16384;
const R = 8;
const P = 1;
const TAM = 64;

export const SENHA_MINIMA = 10;

export async function hashSenha(senha: string): Promise<string> {
  if (senha.length < SENHA_MINIMA) throw new Error(`A senha precisa de ao menos ${SENHA_MINIMA} caracteres.`);
  const sal = randomBytes(16);
  const hash = await scrypt(senha, sal, TAM, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${sal.toString("base64")}$${hash.toString("base64")}`;
}

export async function conferirSenha(senha: string, guardado: string): Promise<boolean> {
  const [alg, n, r, p, sal64, hash64] = guardado.split("$");
  if (alg !== "scrypt" || !sal64 || !hash64) return false;
  const esperado = Buffer.from(hash64, "base64");
  const calculado = await scrypt(senha, Buffer.from(sal64, "base64"), esperado.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const assinatura = (dados: string, segredo: string) => createHmac("sha256", segredo).update(dados).digest("base64url");

export function criarToken(email: string, segredo: string, validadeSeg: number, agora = Date.now()): string {
  const dados = b64(JSON.stringify({ e: email, x: Math.floor(agora / 1000) + validadeSeg }));
  return `${dados}.${assinatura(dados, segredo)}`;
}

/** E-mail da sessão, ou null se a assinatura não bate ou o prazo venceu. */
export function lerToken(token: string | undefined, segredo: string, agora = Date.now()): string | null {
  if (!token) return null;
  const [dados, sig] = token.split(".");
  if (!dados || !sig) return null;
  const esperado = Buffer.from(assinatura(dados, segredo));
  const recebido = Buffer.from(sig);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null;
  try {
    const { e, x } = JSON.parse(Buffer.from(dados, "base64url").toString()) as { e: string; x: number };
    return typeof e === "string" && typeof x === "number" && x > Math.floor(agora / 1000) ? e : null;
  } catch {
    return null;
  }
}

/** Senha forte para o primeiro acesso (letras e números, sem caracteres ambíguos). */
export function senhaAleatoria(tam = 16): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from(randomBytes(tam), (b) => alfabeto[b % alfabeto.length]).join("");
}
