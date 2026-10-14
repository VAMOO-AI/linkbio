# Análise: da coleta à bio na voz da pessoa

Regra que vale acima de todas: **nada inventado.** Preço, número, resultado, depoimento, prêmio e
nome de cliente só entram se estiverem em `analise/` ou se a pessoa disser. Na dúvida, pergunte.

## O que tem em `analise/`

| Arquivo | O que é |
|---|---|
| `instagram.json` | nome, bio, links e categoria do perfil; até 15 posts (mais novo primeiro) com legenda, tipo, curtidas, `autor` e `proprio`; `coresDaFoto` (até 3 cores marcantes da foto do perfil, sem branco, preto e cinza) |
| `foto.jpg` | foto do perfil (só usar com o OK da pessoa) |
| `links.json` | links da bio atual (Linktree e afins) |
| `site.json` | título, descrição, títulos e textos do site; logo, ícone, imagem de compartilhar; `css.cores` (por uso), `css.variaveis` (cores com nome), `css.fontes`, `fontesGoogle`; `renderizado` (fundo, texto, fontes e o botão principal como aparecem na tela, cores já em hex); `arquivos` (logo e capa baixados) |
| `site-computador.png`, `site-celular.png` | fotos do site (navegador de teste): olhe antes de decidir o visual |
| `posts/*.jpg` | imagens dos últimos posts próprios: o jeito da marca no Instagram |
| `logo.*`, `capa.*` | logo e imagem de compartilhar do site, baixados (SVG vira PNG). Só usar com o OK da pessoa |
| `site-sugerido.json` | site que o perfil aponta, quando ela não deu um: confirme antes de ler |

Post com `proprio: false` foi escrito por outra conta (`autor`) que pôs a pessoa como coautora.
Pergunte uma vez: "Os posts em parceria com @autor: é você quem escreve?".
Bio ou nome com letras estilizadas de outro alfabeto (ex.: "Tᥙd᥆ ρᥲrᥲ"): reescreva em letras normais.
Legenda que cita algo que não veio na coleta (calendário "no perfil", destaques, link "na bio" que não
está nos links): pergunte na confirmação ou deixe de fora. Nunca invente o link. Se sim (a conta pessoal
de quem toca a marca, por exemplo), use para a voz; se não (amigo, cliente, família), ignore. Post pessoal
(família, fé, lazer) mostra o jeito, mas não o que ela vende: use para tom, não para oferta.

## Voz → `analise/voz.md`

Escreva em até 25 linhas, sempre com exemplos copiados das legendas, da bio e do site:

1. **Tom:** formal ou solto; sério, bem-humorado, acolhedor, provocativo.
2. **Tratamento:** "você", "vocês", "tu", "galera"; como chama o cliente.
3. **Frases:** curtas ou longas; pergunta no começo; listas; quebras de linha.
4. **Palavras dela:** 5 a 10 que se repetem (inclusive gíria e bordão) e as que ela nunca usa.
5. **Emoji:** usa? quais? onde (no fim, no meio, nenhum)?
6. **Chamada para ação:** como ela convida ("comenta EU QUERO", "link na bio", "me chama").
7. **O que vende:** cada oferta citada, com a frase dela que melhor explica, preço só se apareceu.
8. **Três frases reais** que soam mais como ela.

Aplique em: `profile.bio` (curta, 1 ou 2 linhas no celular), `why` das ofertas, rótulos de botão, mensagens
prontas do WhatsApp, perguntas e respostas do concierge, `site.share.title` (até 70 caracteres) e `description` (até 200).
Prefira frase dela adaptada a frase nova. Sem legendas suficientes (perfil privado ou novo), avise
que a voz fica mais neutra e use o que ela escrever no chat.

## Visual → `analise/visual.md`

Meta: quem conhece a marca reconhece a bio em 1 segundo. Não basta acertar uma cor.

**1. Olhe antes de decidir.** Abra (leia como imagem) `analise/site-celular.png`,
`analise/site-computador.png` e 3 de `analise/posts/*.jpg`. Anote o que dá a cara da marca: fundo,
2 ou 3 cores, brilho ou degradê, tipo de foto, peso das letras, cantos, clima (sério, solar, técnico,
artesanal, luxo). Sem fotos do site (navegador ausente), rode `npx playwright install chromium` e
`npm run analisar -- --site <site>` de novo: o visual sem foto sai fraco.

**2. Cores (paleta completa, não só o destaque).** Fontes, nesta ordem: `renderizado` (o que aparece
na tela), `css.variaveis` com nome (`--primary`, `--brand`, `--bg`, `--surface`, `--card`,
`--border`, `--text`, `--muted`...), `corTema`, as mais usadas de `css.cores`, e o que você viu nas
fotos. Monte `theme.palette.<modo>` com as cores do site:
- `bg` = fundo; `surface` e `surface2` = cards e caixas (um e dois tons acima do fundo);
- `line` = bordas; `text` = texto; `dim` = texto secundário;
- `ctaBg` e `ctaText` = botão principal do site (`renderizado.botaoFundo`/`botaoTexto`), ou o
  destaque com texto que contraste. Botão em degradê (`renderizado.botaoDegrade`): `ctaBg` = 1ª cor
  e `ctaBg2` = 2ª cor (o botão principal vira o mesmo degradê).
- `faint` = linhas e setas decorativas; `shellBg`/`shellText` = o bloco em destaque (concierge
  `destaque`), normalmente um tom acima do fundo com o texto da marca.
`<modo>` é o do modelo (`claro` ou `escuro`, ver a tabela abaixo). `theme.accent` = a cor mais
marcante que não é fundo nem texto. Marca com uma 2ª cor forte (ex.: âmbar e azul): `theme.accent2`
= a 2ª, que vai para os botões vazados (ação dos cards, botão secundário). O check reprova par sem
contraste: ajuste o tom até passar.

**3. Modelo** (define o desenho; as cores vêm da paleta):

| Modelo | Versões | Jeito |
|---|---|---|
| `neutro` | claro e escuro (ponha `theme.mode`) | limpo, serve para quase tudo |
| `noite` | escuro | premium, brilho da cor de destaque |
| `vibrante` | escuro | colorido, forte |
| `editorial` | claro | revista, serifado, sofisticado |
| `vitrine` | claro | loja, produtos em destaque |
| `brutal` | claro | bordas grossas, sombra dura, ousado |

**4. Fonte exata do catálogo** (não a "parecida", se existir): `inter`, `manrope`, `montserrat`,
`poppins`, `dmsans`, `outfit`, `sora`, `albert`, `archivo`, `jakarta`, `grotesk` (Space Grotesk),
`lora`; só para título: `playfair`, `fraunces`, `syne`, `mono` (JetBrains Mono e outras mono),
`serif` (Instrument Serif), `bricolage`. Título e texto diferentes: `{ display, body }` (ex.: site
com Space Grotesk nos títulos e Albert Sans no texto → `{ display: "grotesk", body: "albert" }`).
Fonte fora da lista: a mais parecida no estilo (serifada, geométrica, técnica, display).

**5. Peso, rótulos, forma e textura:**
- `theme.titulo`: `fino` se os títulos do site são leves e grandes, `forte` se são pesados; parecido
  com o padrão da fonte: não defina.
- `theme.rotulos: "mono"` se o site usa letra mono/maiúscula em selos, etiquetas e chips.
- `corners` pelo `renderizado.botaoCanto` (0 a 4px → `reto`; até 12px → `medio`; mais → `redondo`;
  vazio: não defina). `buttons` como os do site (`pilula`, `suave`, `contorno`, `brutal`).
- `background`: liso se o site é liso; `gradiente`/`onda` se tem brilho ou degradê; `pontos` só com
  textura. Site com foto ou imagem forte no topo/fundo: `theme.fundoImagem` com essa imagem em
  `public/` (com o OK dela; vai sob um véu na cor do fundo, o texto continua legível). Só imagem
  SEM texto (foto, textura, cena): imagem de compartilhar com frase escrita vira letra fantasma
  atrás da bio. Na dúvida, abra a imagem antes de usar.

**6. Imagens da marca:** capa dos cards de oferta (`offers[].cover`) com `tone` no clima da marca
(`escuro`, `claro`, `gradiente`) e, com o OK dela, `cover.image` com uma foto dela (posts, site) em
`public/`. Cabeçalho com capa (`profile` `header: "capa"` + `cover`) só com uma imagem aprovada
(`analise/capa.*` ou uma foto dela). Sem imagem, use `header: "centro"`: o `noite` liga a capa por
padrão e, vazia, ela vira uma faixa genérica que não lembra a marca.
Na confirmação (passo 5), peça o OK para cada imagem que vai usar (foto, logo, capa, fundo, posts).

**Fiel:** tudo acima copiando o site: mesma paleta, fontes, cantos, botões e textura.

**Upgrade:** mesma marca (paleta, família de fonte e clima) com o que o motor faz melhor: hierarquia,
contraste garantido, capas nos cards, um modelo que valoriza o que ela vende dentro da mesma versão
(claro ou escuro). Diga em uma frase o que mudou e por quê.

**Sem site:** paleta a partir de `coresDaFoto` e das imagens dos posts (o que domina no feed);
fundo claro ou escuro pelo feed; proponha 1 ou 2 modelos dentro da confirmação (passo 5).

**7. Confira com os olhos.** Com `npm run dev` rodando, `npm run foto` grava
`analise/previa-celular.png`. Abra lado a lado com `analise/site-celular.png` (ou com os posts).
Se a bio não parece da mesma marca, ajuste (paleta, fonte, capa, fundo) e fotografe de novo.
Mostre à pessoa só depois disso.

## Logo e imagem de compartilhar

- `analise/logo.*`: com o OK dela, foto da bio quando não houver foto do Instagram ou ela preferir
  a marca (copie para `public/`).
- `analise/capa.*` (imagem que o site usa ao ser compartilhado): com o OK dela, `site.share.image`
  (copie para `public/`). Sem OK, fica a capa automática.

## Links

- Bio atual (`links.json`; sem ele, os links do perfil em `instagram.json`): cada link vira um item
  de `links` com o título que ela já usa.
- Rede social vai para as redes do topo (`profile.socials`), não para a lista. Os ícones que existem:
  `instagram`, `tiktok`, `youtube`, `whatsapp`, `linkedin`, `facebook`, `x` e `site`. Rede fora
  disso (Threads, Spotify, Pinterest) vira item de `links`.
- Link com `http://`: troque para `https://` (o check só aceita https). Se o endereço não abrir em
  https, deixe de fora e avise.
- Link de WhatsApp: o número que vale é o que ela deu na pergunta 4. Repita o número na confirmação
  para ela conferir (links como `api.whatsapp.com/message/...` não mostram o número).
- Link de compra, agenda ou produto com nome de oferta: proponha virar oferta (card), com o OK dela.
  Oferta é algo concreto com destino (um curso, uma consulta, uma aula, um produto). Loja com muitos
  itens e sem link de compra não vira card: o botão principal do WhatsApp resolve.

## Token da Apify

Um passo por mensagem, esperando o "feito". Cada leitura custa cerca de US$ 0,03 do crédito dela.

1. Entrar em console.apify.com/settings/integrations (menu "Settings" > "API & Integrations"; quem
   ainda não tem conta: "Sign up", dá para entrar com o Google; o plano grátis dá US$ 5 por mês e
   não pede cartão).
2. Em "Personal API tokens", clicar no ícone de copiar ao lado do token (o token nunca vem para a
   conversa).
3. Você garante a linha vazia e abre o arquivo no editor (passos 1 e 2 de "Segurança" no
   `AGENTS.md`, com `APIFY_TOKEN`). Diga: "Abri um arquivo de texto. Na linha que começa com
   APIFY_TOKEN=, cole o token logo depois do `=`, sem espaço. Salve com Cmd+S (Mac) ou Ctrl+S
   (Windows) antes de fechar e me avise."
4. Confira com `grep -c '^APIFY_TOKEN=[A-Za-z0-9_-]\{20,\}' .env.local` (só conta, não mostra
   nada). Deu 1 ou mais: diga "salvei, já consigo ler seu Instagram" e siga. Deu 0: o token não
   entrou inteiro (sobrou espaço ou aspas, ou faltou um pedaço); abra o arquivo de novo.
   Nunca leia nem mostre o arquivo.

## Modo manual (sem acesso ao Instagram)

Peça 3 a 5 legendas que ela escreveu (copiar do Instagram e mandar aqui na conversa) e o texto da bio do perfil.
Para o site, a coleta não precisa de acesso: rode `npm run analisar -- --site <site>`. Os links da
bio atual também: `npm run analisar -- --bio-atual <link>`.
