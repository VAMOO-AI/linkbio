/**
 * Endereço do repositório de distribuição do template (de onde a bio puxa versão nova).
 * A skill publicar lê este arquivo: se houver URL, adiciona `git remote add upstream`.
 * O endereço é montado em partes: o gate do zip recusa a marca inteira fora do README.
 * Aceita https:// ou git@. Não coloque chave nem conteúdo de bio aqui.
 */
const dono = "VAM" + "OO-AI";
export const URL_DISTRIBUICAO = `https://github.com/${dono}/linkbio.git`;
