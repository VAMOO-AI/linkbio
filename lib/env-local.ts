/**
 * Leitura e escrita de uma variável num texto no formato do .env.local, sem depender de pacote.
 * Vale a ÚLTIMA linha com a chave (como o Next lê); gravar troca todas as linhas dela por uma só.
 */
export function lerVariavel(texto: string, chave: string): string {
  const linhas = texto.split(/\r?\n/).filter((l) => l.startsWith(`${chave}=`));
  const ultima = linhas.at(-1);
  return ultima ? ultima.slice(chave.length + 1).trim().replace(/^["']|["']$/g, "") : "";
}

export function gravarVariavel(texto: string, chave: string, valor: string): string {
  const linhas = texto.split(/\r?\n/);
  const i = linhas.findIndex((l) => l.startsWith(`${chave}=`));
  if (i === -1) {
    const base = texto === "" || texto.endsWith("\n") ? texto : `${texto}\n`;
    return `${base}${chave}=${valor}\n`;
  }
  linhas[i] = `${chave}=${valor}`;
  return linhas.filter((l, j) => j === i || !l.startsWith(`${chave}=`)).join("\n");
}
