# Visual

Ordem de camadas: modelo < `theme` < campo do bloco. Mude o mínimo: primeiro o modelo, depois a
cor de destaque, só então o resto. Ao trocar de modelo, apague de `theme` o que a pessoa não
escolheu (`font`, `radius`, `buttons`...): sobra do exemplo prende o visual antigo. Lista completa com descrição: `config/opcoes.ts` e o README
("Todas as opções visuais"). Não invente valor.

## Modelos (`theme.preset`)

| Modelo | Como é |
|---|---|
| `neutro` | claro e escuro automáticos, botão preto, azul de acento |
| `noite` | escuro, capa no topo, brilho da cor de destaque |
| `editorial` | papel bege, título serifado, visual de revista |
| `vitrine` | claro e quente, para mostrar produtos |
| `brutal` | amarelo, bordas grossas, sombra dura |
| `vibrante` | roxo profundo, destaque forte |

## Página inteira (`theme`)

| Campo | O que muda | Valores |
|---|---|---|
| `mode` | claro ou escuro | só o `neutro` tem os três (`auto`, `claro`, `escuro`). `noite` e `vibrante` são só `escuro`; `editorial`, `vitrine` e `brutal`, só `claro`. Para escurecer um modelo claro, troque de modelo (ex.: `noite`) |
| `accent` | cor de destaque (links, preço, detalhes) | hex, ex.: `"#2563EB"`. Se faltar contraste, o motor ajusta sozinho |
| `font` | fontes | `jakarta`, `inter`, `manrope`, `montserrat`, `poppins`, `dmsans`, `outfit`, `sora`, `albert`, `archivo`, `grotesk`, `lora`; só títulos: `serif`, `playfair`, `fraunces`, `syne`, `mono`, `bricolage`. Separadas: `{ display: "playfair", body: "inter" }` (títulos e texto) |
| `accent2` | 2ª cor da marca, nos botões vazados | hex; sem ela, a cor do texto |
| `titulo` | peso dos títulos | `fino`, `normal`, `forte` |
| `rotulos` | selos e etiquetas | `padrao`, `mono` (técnico, maiúsculo) |
| `fundoImagem` | imagem de fundo da página | arquivo em `public/` (sob véu na cor do fundo) |
| `background` | fundo | `onda`, `gradiente`, `pontos`, `liso` |
| `buttons` | botões | `pilula`, `suave`, `contorno`, `brutal` |
| `corners` | cantos de botões e cards | `reto`, `medio`, `redondo` |
| `radius` | raio exato em px de cards, caixas e imagens | inteiro de 0 a 24; substitui `corners` nesses lugares. Nos botões só vale com `buttons` `suave` ou `brutal` (até 14). O exemplo vem com `radius: 6`: apague para `corners` valer |
| `palette.claro` / `palette.escuro` | cores avançadas do modelo | hex por cor, só do modo que o modelo tem; o check reprova par sem contraste AA |

Valores antigos (`neutro-claro`, `Plus Jakarta Sans`) ainda funcionam; ao editar, troque pelos
novos (`neutro`, `jakarta`).

## Jeito de cada bloco

| Bloco | Campo | Valores |
|---|---|---|
| `profile` | `header` | `centro`, `capa` (usa `cover`), `lado` |
| `profile` | `socials` | `icones`, `nomes`, `oculto` |
| `cta` | `variant`, `pulse` | `primario`, `secundario`; `pulse: true` põe um ponto verde de "online" no botão (não pisca) |
| `cards` | `layout` | `carrossel`, `lista`, `grade`, `destaque` |
| `links` | `layout` | `lista`, `botoes`, `icones` |
| `products` | `layout`, `filter` | `carrossel`, `grade`; `filter: true` mostra filtro por categoria |
| `concierge` | `variant`, `collapsed` | `destaque`, `leve`; `collapsed: true` começa fechado |
| `text` | `variant` | `padrao`, `rodape` |

## Como conduzir

Pergunte o que a pessoa quer sentir ("mais sério", "mais colorido") e proponha 1 ou 2 opções.
