/**
 * Indicadores de "como alterar" do /admin: o que cada seção e cada bloco é, onde aparece na bio e
 * como mudar, em uma linha. Separado de `rotulos.ts` (nomes de campo) para os dois crescerem sem
 * se atropelar. Só dados: o editor client importa este arquivo.
 */

/** Uma linha por seção, logo abaixo do título: o que é e onde aparece na bio. */
export const AJUDA_SECAO: Record<string, string> = {
  blocos: "Cada linha é uma parte da bio, na ordem em que aparece de cima para baixo. Clique numa linha para editar; use o menu ··· (Subir e Descer) ou, no computador, arraste pela alça para mudar de lugar e a chave para esconder sem apagar. Em cada bloco, \"Mostrar só entre datas\" tira do ar sozinho quando o prazo acaba.",
  perfil: "O topo da bio: foto, nome, @, bio, etiquetas e redes. Aparece onde estiver o bloco Perfil (normalmente o primeiro).",
  aparencia: "O visual da bio inteira. Escolha um modelo e, se quiser, ajuste cores, fonte, fundo, botões e cantos por cima dele.",
  ofertas: "O que você vende ou oferece. Aparece nos cards do bloco Ofertas e no final do Concierge. Opcional: bio só de links também vale.",
  vitrine: "Produtos com preço e categoria. Aparecem na bio pelo bloco Vitrine.",
  contato: "O WhatsApp que recebe as mensagens de todos os botões, o endereço onde a bio fica no ar e, se quiser, a medição de visitas. O pixel só carrega depois que a pessoa aceitar o aviso de cookies.",
  versoes: "Cada Publicar guarda uma versão. Restaurar traz uma versão antiga de volta como versão nova: nada se perde.",
  resultados: "Quantas pessoas tocaram em cada botão da bio, nos últimos 7 e 30 dias. Sem cookie e sem ferramenta de fora.",
  contatos: "Nome, WhatsApp e e-mail de quem preencheu o formulário de contato. Dá para baixar a lista.",
};

/** Uma linha no topo de cada bloco aberto: o que ele mostra e onde. */
export const AJUDA_BLOCO: Record<string, string> = {
  profile: "Mostra foto, nome, @, bio, etiquetas e redes. O conteúdo se edita na seção Perfil; aqui só o jeito de mostrar.",
  cta: "Botão grande, em destaque. Ao tocar, abre o WhatsApp com a mensagem pronta ou um link.",
  banner: "Faixa colorida para um aviso do momento (turma nova, evento, promoção), com botão opcional.",
  concierge: "Algumas perguntas rápidas que indicam a oferta certa para quem visita a bio.",
  cards: "Cards das suas ofertas, com capa, preço e botão. Editar um card aqui muda a oferta em todo lugar.",
  products: "Vitrine dos produtos da seção Vitrine, com preço e filtro por categoria.",
  coupon: "Cupom de desconto que a pessoa copia com um toque.",
  pix: "QR Code e código copia-e-cola. A pessoa copia com um toque. O nome vai sem acento no código do banco.",
  agenda: "Próximos eventos, com Google Agenda e arquivo para baixar. Evento que já passou some sozinho: a página atualiza de hora em hora, ou na hora se você publicar de novo.",
  link: "Um link sozinho, em formato de card (com imagem, se quiser).",
  links: "Vários links juntos numa lista, com um título em cima.",
  social: "Uma fileira de ícones das suas redes, no ponto da bio onde o bloco estiver.",
  youtube: "Um vídeo do YouTube que toca dentro da bio.",
  gallery: "Fotos lado a lado.",
  testimonials: "Depoimentos de clientes. Use só depoimentos reais.",
  faq: "Perguntas e respostas que abrem e fecham ao tocar.",
  text: "Um texto livre. Com o estilo Rodapé, fica centralizado e discreto, bom para o fim da bio.",
  divider: "Uma linha fina para separar partes da bio. Não tem nada para preencher.",
  lead: "Formulário para a pessoa deixar o nome e o WhatsApp ou o e-mail (material grátis, lista de espera). Os contatos ficam na seção Contatos.",
};

/**
 * Dica de um campo pelo lugar dele na config (sem os números das listas): "profile.name",
 * "offers.title". Vale antes da dica genérica por nome de campo (DICAS), que não sabe onde está.
 */
export const DICA_POR_LUGAR: Record<string, string> = {
  "profile.name": "Aparece em destaque no topo da bio.",
  "profile.bio": "Uma ou duas frases logo abaixo do nome, dizendo o que você faz e para quem.",
  "profile.tags": "Palavras curtas abaixo da bio (até 5). Digite e tecle Enter; as setas mudam a ordem.",
  "profile.avatar": "A foto redonda do topo. Quadrada fica melhor.",
  "profile.tipo": "Pessoa: a bio é de alguém. Empresa: a bio é de um negócio. No Google, empresa aparece como organização e a foto vira o logo.",
  "profile.socials": "Ícones redondos abaixo das etiquetas, no topo da bio.",
  "profile.socials.rotulo": "Nome da rede. Aparece ao passar o mouse e é lido por quem usa leitor de tela.",
  "offers.title": "Nome da oferta no card e no final do Concierge.",
  "offers.why": "Uma ou duas frases no card, abaixo do título.",
  "offers.cta": "Texto do botão do card. Vazio: \"Quero essa\".",
  "offers.cover": "A parte de cima do card: imagem ou um título grande.",
  "catalog.title": "Nome do produto na vitrine.",
  "catalog.category": "Agrupa os produtos no filtro da vitrine (ex.: Cursos, Livros).",
  "contact.whatsapp": "Recebe as mensagens de todos os botões de WhatsApp da bio. Digite do jeito que quiser, ex.: (11) 98765-4321.",
  "site.url": "O endereço onde a bio fica no ar (o link que você coloca no Instagram).",
  "features.pixel.meta":
    "Número do Pixel, no Gerenciador de Eventos da Meta: Fontes de dados, o seu pixel, o número. Só números, de 10 a 20 dígitos. Vazio: a bio não carrega o pixel.",
  "features.pixel.ga4":
    "No Google Analytics: Administrador, Coleta de dados, Fluxos de dados, o fluxo da web, ID de medição. Começa com G-. Vazio: a bio não carrega o Google.",
  "entrega.url": "Link https do arquivo ou da página que a pessoa recebe depois de enviar.",
};

/** Nome no singular do item que o botão "Adicionar ..." cria, por lista. */
export const ITEM_SINGULAR: Record<string, string> = {
  offers: "oferta",
  catalog: "produto",
  socials: "rede",
  images: "imagem",
  flow: "pergunta",
  options: "resposta",
  "items:links": "link",
  "items:social": "rede",
  "items:testimonials": "depoimento",
  "items:faq": "pergunta",
  "items:agenda": "evento",
};
