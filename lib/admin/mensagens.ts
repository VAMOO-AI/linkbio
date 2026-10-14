/**
 * Mensagens do schema traduzidas para quem usa o painel.
 *
 * O schema (config/schema.ts) fala com quem edita o arquivo: cita o caminho do campo
 * ("offers[].why é obrigatório"). No painel a pessoa já vê o campo e o nome dele em português, então
 * o caminho técnico sai e as referências internas viram frases. O `npm run check` continua com a
 * mensagem original. Testes em tests/admin-mensagens.test.ts.
 */

/** Mensagens inteiras que pedem outra frase (referências entre partes da config). */
const INTEIRAS: [RegExp, string][] = [
  [/^bloco cards referencia a oferta "(.+?)", que não existe em offers\..*$/s, 'A oferta "$1" foi apagada ou renomeada: tire este card do bloco ou inclua outra oferta.'],
  [/^concierge \(passo "(.+?)"\) referencia a oferta "(.+?)", que não existe em offers\..*$/s, 'Uma resposta leva para a oferta "$2", que foi apagada: escolha outra em "Leva para".'],
  [/^bloco products referencia o produto "(.+?)", que não existe em catalog\..*$/s, 'O produto "$1" foi apagado ou renomeado: desmarque ou escolha outro.'],
  [/^bloco products precisa de produtos em catalog.*$/s, "A vitrine precisa de produtos: cadastre na seção Vitrine."],
  [/^concierge: a resposta "(.+?)" da (\d+)ª pergunta (?:leva para uma oferta e )?precisa de reason.*$/s, 'A resposta "$1" da $2ª pergunta precisa da explicação no final.'],
  [/^bloco concierge: decide inválido.*$/s, 'Escolha quem decide o final do concierge: "Só a 1ª pergunta" ou "A última resposta com destino".'],
  [/^bloco concierge: mode deve ser.*$/s, 'Escolha o modo do concierge: "Roteiro" ou "Roteiro + dúvida livre (IA)".'],
  [/^cada oferta precisa de ao menos um destino.*$/s, 'A oferta precisa de um destino: preencha o "Link" ou a "Mensagem do WhatsApp".'],
  [/^defina ao menos 1 bloco em blocks\.$/, "A página precisa de pelo menos 1 bloco."],
  [/^bloco banner: label exige action.*$/s, 'O aviso tem texto de botão mas não tem destino: preencha "Ao clicar, abre" ou apague o texto do botão.'],
  [/^bloco banner: action exige label.*$/s, 'O aviso tem destino mas não tem texto de botão: preencha "Texto do botão".'],
  [/^bloco coupon: cta exige action.*$/s, 'O cupom tem texto de botão mas não tem destino: preencha "Ao clicar, abre" ou apague o texto do botão.'],
  [/^bloco lead: pedir deve ser.*$/s, "Escolha o que pedir: WhatsApp, e-mail ou os dois."],
  [/^bloco youtube: videoId deve ser.*$/s, "Cole o link do vídeo do YouTube (ex.: https://youtu.be/... ou https://www.youtube.com/watch?v=...)."],
  [/^(blocks|offers|catalog) tem o id "(.+?)" repetido.*$/s, 'Dois itens têm o mesmo identificador "$2" (fica em Avançado): mude um deles.'],
  [/^theme\.mode "(?:claro|escuro)" não existe no modelo "(.+?)" \(só (claro|escuro)\).*$/s, 'O modelo escolhido só tem a versão $2: em "Claro ou escuro", escolha $2 ou troque de modelo.'],
  [/^theme\.mode "auto" precisa.*$/s, 'O modelo escolhido tem uma versão só: em "Claro ou escuro", troque o automático pela versão dele.'],
  [/^theme\.palette\.(claro|escuro) não tem efeito.*$/s, 'O modelo escolhido não tem a versão $1: remova a paleta $1 em "Cores do modelo".'],
  [/^contact\.whatsapp deve conter só dígitos.*$/s, "Digite o número com DDD (ex.: 11 98765-4321). O painel acrescenta o 55 do Brasil."],
  // Quantidade de itens: o nome do bloco em inglês ("o bloco gallery") não dizia nada a quem edita.
  [/^o bloco gallery precisa de ao menos 1 imagem\.$/, "Adicione ao menos 1 imagem."],
  [/^o bloco social precisa de ao menos 1 item\.$/, "Adicione ao menos 1 rede."],
  [/^o bloco links precisa de ao menos 1 item\.$/, "Adicione ao menos 1 link."],
  [/^o bloco links aceita no máximo (\d+) itens\.$/, "Cabem no máximo $1 links: apague um."],
  [/^o bloco testimonials precisa de ao menos 1 depoimento\.$/, "Adicione ao menos 1 depoimento."],
  [/^o bloco testimonials aceita no máximo (\d+) depoimentos\.$/, "Cabem no máximo $1 depoimentos: apague um."],
  [/^o bloco faq precisa de ao menos 1 pergunta\.$/, "Adicione ao menos 1 pergunta."],
  [/^o bloco faq aceita no máximo (\d+) perguntas\.$/, "Cabem no máximo $1 perguntas: apague uma."],
  [/^o bloco agenda precisa de ao menos 1 evento\.$/, "Adicione ao menos 1 evento."],
  [/^o bloco agenda aceita no máximo (\d+) eventos\.$/, "Cabem no máximo $1 eventos: apague um."],
  [/^agenda tem o id "(.+?)" repetido\..*$/s, 'Dois eventos têm o mesmo identificador "$1" (fica em Avançado): mude um deles.'],
  [/^o bloco concierge precisa de ao menos 1 passo.*$/s, "O concierge precisa de ao menos 1 pergunta."],
  [/^concierge: cada passo precisa de ao menos (\d+) opções\.$/, "Cada pergunta precisa de ao menos $1 respostas."],
  [/^concierge: cada passo aceita no máximo (\d+) opções\.$/, "Cabem no máximo $1 respostas por pergunta: apague uma."],
  [/^ícone social inválido\..*$/s, "Escolha uma das opções."],
  [/^.*action precisa ser \{ wa \} ou \{ url \}\.$/s, 'Escolha para onde o botão leva: "WhatsApp" ou "Link".'],
  [
    /^o filtro da vitrine aceita até (\d+) categorias; este bloco tem (\d+) \((.*)\)\. Junte categorias ou divida em dois blocos products\.$/s,
    "O filtro da vitrine aceita até $1 categorias; esta vitrine tem $2 ($3). Junte categorias ou divida em duas vitrines.",
  ],
];

/** Pedaços que aparecem no meio das mensagens. */
const TRECHOS: [RegExp, string][] = [
  [/uma URL externa com https \(ex\.: "https:\/\/instagram\.com\/perfil"\)/g, 'um link completo, começando com https:// (ex.: "https://instagram.com/perfil")'],
  [/deve ser um slug estável escrito à mão \(minúsculas, números e hífens, ex\.: "mentoria"\)/g, 'deve ter só letras minúsculas, números e hífens (ex.: "mentoria")'],
  [/deve ser um arquivo em public\/ começando com "\/" \(ex\.: "\/avatar\.jpg"\) ou uma URL https/g, "deve ser uma imagem enviada pelo botão ou um link https"],
  [/deve estar no formato AAAA-MM-DD \(ex\.: "2026-12-31"\)/g, "deve ser uma data válida"],
];

/**
 * Começo técnico da mensagem: "site.url", "offers[].why", "bloco youtube: videoId",
 * "bloco links: items[].title", "concierge: opção label", "social: url", "theme.palette.bg".
 */
const PREFIXO =
  /^(?:(?:bloco [a-z]+|social|concierge): )?(?:(?:opção|passo) )?[A-Za-z_]+(?:\[\])?(?:\.[A-Za-z_]+(?:\[\])?)*(?= (?:deve|é|não|precisa|aceita|inválido))/;

export function mensagemParaLeigo(mensagem: string): string {
  for (const [re, troca] of INTEIRAS) if (re.test(mensagem)) return mensagem.replace(re, troca);
  let m = mensagem.replace(PREFIXO, "Este campo");
  for (const [re, troca] of TRECHOS) m = m.replace(re, troca);
  // Enum inválido: a lista de valores técnicos não ajuda quem escolhe num menu.
  m = m.replace(/^Este campo inválido\..*$/s, "Escolha uma das opções.");
  return m;
}
