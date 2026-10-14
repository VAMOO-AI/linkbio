/**
 * Pix copia e cola (BR Code EMV estático), no servidor.
 * Manual de Padrões para Iniciação do Pix: campos 00, 26 (GUI br.gov.bcb.pix),
 * 52, 53=986, 54 se houver valor, 58=BR, 59, 60, 62 (txid, *** se vazio) e 63 (CRC16-CCITT-FALSE).
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EVP = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TEL = /^\+55[1-9]{2}\d{8,9}$/;

/** Tira acento e o que o Pix não carrega no nome e na cidade. */
export function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cpfOk(d: string): boolean {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const n = [...d].map(Number);
  const dv = (tam: number) => {
    let s = 0;
    for (let i = 0; i < tam; i++) s += n[i]! * (tam + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === n[9] && dv(10) === n[10];
}

function cnpjOk(d: string): boolean {
  if (!/^\d{14}$/.test(d) || /^(\d)\1{13}$/.test(d)) return false;
  const n = [...d].map(Number);
  const dv = (tam: number) => {
    const pesos = tam === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let s = 0;
    for (let i = 0; i < tam; i++) s += n[i]! * pesos[i]!;
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === n[12] && dv(13) === n[13];
}

/** null = chave válida. Senão, a frase em português (com o caminho, para o arquivo e o check). */
export function mensagemDaChave(chave: string): string | null {
  const t = chave.trim();
  if (!t) return "bloco pix: chave é obrigatória.";
  if (t.includes("@")) {
    if (EMAIL.test(t) && t.length <= 77) return null;
    return "bloco pix: chave deve ser um e-mail completo, com no máximo 77 caracteres.";
  }
  if (EVP.test(t)) return null;
  if (t.startsWith("+")) {
    if (TEL.test(t)) return null;
    return 'bloco pix: chave não está no formato de telefone do Brasil com +55 e DDD (ex.: "+5511987654321").';
  }
  if (/^\d{11}$/.test(t)) {
    if (cpfOk(t)) return null;
    return "bloco pix: chave não confere como CPF (os dígitos verificadores não batem). Se for telefone, use +55 e o DDD.";
  }
  if (/^\d{14}$/.test(t)) {
    if (cnpjOk(t)) return null;
    return "bloco pix: chave não confere como CNPJ (os dígitos verificadores não batem).";
  }
  return "bloco pix: chave deve ser CPF (11 dígitos), CNPJ (14 dígitos), e-mail, telefone com +55 ou chave aleatória.";
}

/** CRC-16/CCITT-FALSE (polinômio 0x1021, inicial 0xFFFF), 4 hex maiúsculos. */
export function crc16(texto: string): string {
  let crc = 0xffff;
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
      else crc <<= 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function campo(id: string, valor: string): string {
  return `${id}${String(valor.length).padStart(2, "0")}${valor}`;
}

function chaveNoPayload(chave: string): string {
  const t = chave.trim();
  if (t.includes("@") || EVP.test(t)) return t.toLowerCase();
  return t;
}

export type DadosPix = {
  chave: string;
  nome: string;
  cidade: string;
  valor_cents?: number;
  txid?: string;
};

/** BR Code estático. Nome e cidade perdem o acento aqui; a página pode mostrar com acento. */
export function gerarBrCode(dados: DadosPix): string {
  const nome = semAcento(dados.nome);
  const cidade = semAcento(dados.cidade);
  if (!nome || nome.length > 25) throw new Error("Nome do Pix precisa ter de 1 a 25 letras ou números, sem acento.");
  if (!cidade || cidade.length > 15) throw new Error("Cidade do Pix precisa ter de 1 a 15 letras ou números, sem acento.");
  const txid = dados.txid && dados.txid !== "***" ? dados.txid : "***";
  const partes = [
    campo("00", "01"),
    campo("26", campo("00", "br.gov.bcb.pix") + campo("01", chaveNoPayload(dados.chave))),
    campo("52", "0000"),
    campo("53", "986"),
  ];
  if (dados.valor_cents !== undefined && dados.valor_cents > 0) {
    const reais = Math.floor(dados.valor_cents / 100);
    const cents = String(dados.valor_cents % 100).padStart(2, "0");
    partes.push(campo("54", `${reais}.${cents}`));
  }
  partes.push(campo("58", "BR"), campo("59", nome), campo("60", cidade), campo("62", campo("05", txid)));
  const semCrc = `${partes.join("")}6304`;
  return semCrc + crc16(semCrc);
}
