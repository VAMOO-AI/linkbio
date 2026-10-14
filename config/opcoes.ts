/**
 * Catálogo das opções visuais da linkbio.config.ts.
 * Fonte única: o schema (enums e mensagens de erro), o README e as skills leem daqui.
 * Chaves de campo em inglês, valores em português (ex.: background: "onda").
 * Só servidor: nenhum componente client importa este arquivo.
 */

export type Opcao = { rotulo: string; descricao: string };

export const OPCOES = {
  preset: {
    neutro: { rotulo: "Neutro", descricao: "Claro e escuro automáticos, botão preto em pílula, azul como acento." },
    noite: { rotulo: "Noite", descricao: "Escuro, com capa no topo e brilho da cor de destaque." },
    editorial: { rotulo: "Editorial", descricao: "Papel bege, título serifado, visual de revista." },
    vitrine: { rotulo: "Vitrine", descricao: "Claro e quente, pensado para mostrar produtos." },
    brutal: { rotulo: "Brutal", descricao: "Amarelo, bordas grossas e sombra dura." },
    vibrante: { rotulo: "Vibrante", descricao: "Roxo profundo com destaque forte, para criador de conteúdo." },
  },
  mode: {
    auto: { rotulo: "Automático", descricao: "Segue o claro ou escuro do celular (só em modelo com as duas paletas)." },
    claro: { rotulo: "Claro", descricao: "Sempre claro." },
    escuro: { rotulo: "Escuro", descricao: "Sempre escuro." },
  },
  font: {
    jakarta: { rotulo: "Jakarta", descricao: "Plus Jakarta Sans: moderna e neutra." },
    serif: { rotulo: "Serifada", descricao: "Instrument Serif nos títulos, Jakarta no texto." },
    grotesk: { rotulo: "Grotesk", descricao: "Space Grotesk: técnica e marcante." },
    bricolage: { rotulo: "Bricolage", descricao: "Bricolage Grotesque nos títulos: expressiva." },
    inter: { rotulo: "Inter", descricao: "Inter: limpa, de interface." },
    manrope: { rotulo: "Manrope", descricao: "Manrope: geométrica e moderna." },
    montserrat: { rotulo: "Montserrat", descricao: "Montserrat: larga e firme." },
    poppins: { rotulo: "Poppins", descricao: "Poppins: redonda e amigável." },
    dmsans: { rotulo: "DM Sans", descricao: "DM Sans: simples e leve." },
    outfit: { rotulo: "Outfit", descricao: "Outfit: geométrica e jovem." },
    sora: { rotulo: "Sora", descricao: "Sora: técnica e arejada." },
    albert: { rotulo: "Albert Sans", descricao: "Albert Sans: neutra e elegante." },
    archivo: { rotulo: "Archivo", descricao: "Archivo: forte e compacta." },
    lora: { rotulo: "Lora", descricao: "Lora: serifada de leitura confortável." },
    playfair: { rotulo: "Playfair", descricao: "Playfair Display nos títulos: clássica e sofisticada." },
    fraunces: { rotulo: "Fraunces", descricao: "Fraunces nos títulos: serifada com personalidade." },
    syne: { rotulo: "Syne", descricao: "Syne nos títulos: ousada e artística." },
    mono: { rotulo: "Mono", descricao: "JetBrains Mono nos títulos: técnica, de código." },
  },
  titulo: {
    fino: { rotulo: "Fino", descricao: "Títulos leves e grandes, elegantes." },
    normal: { rotulo: "Normal", descricao: "Peso médio, equilibrado." },
    forte: { rotulo: "Forte", descricao: "Títulos bem pesados, de impacto." },
  },
  rotulos: {
    padrao: { rotulo: "Padrão", descricao: "Selos e etiquetas na fonte do texto." },
    mono: { rotulo: "Técnico", descricao: "Selos, etiquetas e rótulos em letra mono, maiúscula e espaçada." },
  },
  background: {
    onda: { rotulo: "Onda", descricao: "Degradê suave da cor de destaque no topo." },
    gradiente: { rotulo: "Brilho", descricao: "Brilho radial da cor de destaque atrás do perfil." },
    pontos: { rotulo: "Pontos", descricao: "Textura de pontos na página inteira." },
    liso: { rotulo: "Liso", descricao: "Só a cor de fundo." },
  },
  buttons: {
    pilula: { rotulo: "Pílula", descricao: "Botões totalmente arredondados." },
    suave: { rotulo: "Suave", descricao: "Botões com cantos arredondados." },
    contorno: { rotulo: "Contorno", descricao: "Botão principal vazado, só com borda." },
    brutal: { rotulo: "Brutal", descricao: "Borda grossa e sombra dura deslocada." },
  },
  corners: {
    reto: { rotulo: "Retos", descricao: "Cantos quase retos (4 px)." },
    medio: { rotulo: "Médios", descricao: "Cantos arredondados (14 px)." },
    redondo: { rotulo: "Redondos", descricao: "Cantos bem arredondados (22 px)." },
  },
  header: {
    centro: { rotulo: "Centro", descricao: "Foto, nome e bio centralizados." },
    capa: { rotulo: "Com capa", descricao: "Faixa de capa no topo, foto sobreposta." },
    lado: { rotulo: "Lado a lado", descricao: "Foto à esquerda, nome e bio à direita." },
  },
  socials: {
    icones: { rotulo: "Ícones", descricao: "Redes como ícones redondos." },
    nomes: { rotulo: "Com nome", descricao: "Redes como pílulas com o nome." },
    oculto: { rotulo: "Ocultas", descricao: "Não mostra as redes no cabeçalho." },
  },
  cardsLayout: {
    carrossel: { rotulo: "Carrossel", descricao: "Cards lado a lado, arrastando para o lado." },
    lista: { rotulo: "Lista", descricao: "Um card por linha, capa à esquerda." },
    grade: { rotulo: "Grade", descricao: "Duas colunas, sem descrição." },
    destaque: { rotulo: "Destaque", descricao: "O primeiro card grande, os outros em linha." },
  },
  linksLayout: {
    lista: { rotulo: "Lista", descricao: "Links numa caixa, um por linha." },
    botoes: { rotulo: "Botões", descricao: "Cada link é um botão." },
    icones: { rotulo: "Ícones", descricao: "Grade de três colunas com ícone." },
  },
  concierge: {
    destaque: { rotulo: "Destaque", descricao: "Card escuro de destaque, o elemento mais forte da página." },
    leve: { rotulo: "Leve", descricao: "Card claro com borda, discreto." },
  },
  conciergeDecide: {
    primeira: { rotulo: "Só a 1ª pergunta", descricao: "A resposta da 1ª pergunta decide o final; as outras vão como contexto na mensagem." },
    ultima: {
      rotulo: "A última resposta com destino",
      descricao: "Vale a última resposta que leva para uma oferta ou tem explicação própria; sem nenhuma, vale a 1ª.",
    },
  },
  productsLayout: {
    carrossel: { rotulo: "Carrossel", descricao: "Produtos lado a lado, arrastando." },
    grade: { rotulo: "Grade", descricao: "Produtos em duas colunas." },
  },
} as const satisfies Record<string, Record<string, Opcao>>;

export type Opcoes = typeof OPCOES;
export type ChaveDe<G extends keyof Opcoes> = keyof Opcoes[G] & string;
