# Linkbio

Template de página de links (link-in-bio) em Next.js + Supabase, feito para ser
configurado com o Claude Code. Você edita um arquivo de config, o Claude valida
e publica.

## Começo rápido (sem terminal)

Você não precisa abrir terminal nem escrever código: o Claude roda tudo e você só conversa e
clica. O mesmo passo a passo, para ler no navegador, está em `COMECE-AQUI.html` (abra com dois cliques).

1. Instale o app do Claude (claude.ai/download) e entre na sua conta. O modo Code pede plano pago
   (Pro ou Max).
2. Descompacte o `linkbio-vX.Y.Z.zip` e mova a pasta `linkbio/` para a sua pasta pessoal: no Mac
   fica `~/linkbio` (Finder > Ir > Pasta Pessoal); no Windows, `C:\Users\<seu nome>\linkbio`. Evite
   Documentos (costuma sincronizar com iCloud ou OneDrive), Downloads e qualquer pasta de nuvem.
   No Windows, o "Extrair tudo" às vezes cria uma pasta dentro de outra: a certa é a de dentro, a
   que tem o arquivo `package.json`.
3. No app do Claude, abra a aba **Code**, escolha a pasta `linkbio/` e comece uma conversa nova.
   Se o app perguntar se você confia na pasta, clique em confiar.
4. Mande esta mensagem:

   ```text
   Monta a minha bio. Eu não uso terminal: faça tudo por mim e me diga só onde clicar.
   ```

5. Durante o setup, só clique. A pasta já vem no modo aceitar edições, então os comandos do dia a dia
   rodam sem perguntar; ainda aparece "Permitir" para instalar programas e para o que apaga ou mexe em
   chave. Clique também nas janelas do
   próprio computador (instalador do Node, senha do Mac, "Sim" do Windows). No Windows, se faltar
   o Git (o Claude precisa dele para rodar os comandos), ele mesmo instala. Se o Claude pedir para
   fechar e abrir o app, abra a mesma pasta e escreva `continua`.

O que acontece: o Claude pergunta nome, @ do Instagram, site, WhatsApp e o nome do endereço grátis
(`seunome.vercel.app`; domínio próprio entra depois), lê seu Instagram, seu site e sua bio atual
(Linktree e afins), mostra o que entendeu e escreve a bio inteira no seu jeito de falar.
Para ler o Instagram ele usa o token da sua conta Apify: ele mostra onde pegar e abre um arquivo de
texto para você colar. **Chave nunca vai no chat**; se ele pedir no chat, responda "abra o arquivo
para eu colar". Sem token, você manda algumas legendas e funciona também (a voz fica um pouco mais
neutra). Se você tiver site, ele pergunta se quer a bio 100% fiel ao site ou uma sugestão de
upgrade.

Depois, no dia a dia, é só pedir em linguagem normal:

| O que você quer | Mande |
|---|---|
| Colocar no ar | `Coloca a minha bio no ar.` |
| Mudar algo | `Muda o preço da consulta para 250.` / `Troca minha foto.` |
| Editar pelo celular | `Quero editar a bio pelo celular.` |
| Usar seu domínio | `Quero usar o meu domínio.` |
| Versão nova do template | `Chegou versão nova do template. O zip está em Downloads.` |

O que você precisa: um computador (Mac ou Windows) com o app do Claude; o Node 22.12 ou mais novo
(e, no Windows, o Git) o próprio Claude confere e instala. Para colocar no ar, contas gratuitas no GitHub e na Vercel;
para editar pelo celular, no Supabase.

## Skills do Claude Code

Peça em linguagem normal; o Claude escolhe a skill certa (ficam em `.claude/skills/`).

| Peça | Skill |
|---|---|
| "rode o setup da minha bio" | `setup-linkbio` |
| "adiciona o link do...", "muda o preço", "troca minha foto", "muda a cor", "deixa escuro" | `editar-bio` |
| "quero editar pelo celular", "esqueci a senha do painel" | `ligar-painel` |
| "coloca no ar", "usar meu domínio" | `publicar` |
| "tem versão nova do template" | `atualizar-template` |
| "preciso de um bloco que não existe" (quando nenhum dos 19 resolve) | `novo-bloco` |

## Onde mexer

- `linkbio.config.ts` — todo o conteúdo da bio: perfil, blocos, ofertas, tema.
  É o único arquivo de código que você edita no dia a dia.
- `public/` — foto de perfil (`avatar.jpg`), imagens (galeria, capas, produtos) e favicon.
- Todo o resto (`app/`, `blocks/`, `lib/`, `config/`) é motor do template:
  não edite. Se faltar um bloco, peça ao Claude (skill `novo-bloco`).

## Modelos prontos

A bio começa num dos 6 modelos visuais. Troque numa linha só:

```ts
theme: { preset: "noite" },
```

Tudo o que o modelo define pode ser sobrescrito no `theme` (cor de destaque,
fonte, fundo, botões, cantos, modo claro ou escuro) ou no próprio bloco
(layout dos cards, dos links, da vitrine, estilo do concierge). A ordem de
quem manda é: modelo < `theme` < campo do bloco.

Cores trocadas em `theme.palette` passam pelo teste de contraste no
`npm run check`: se o texto ficar difícil de ler, o check aponta a cor e o
mínimo exigido.

## Blocos

Os blocos entram em `blocks`, na ordem em que aparecem na página. Todos
aceitam `id` (opcional), `enabled` (liga e desliga) e `visivel` (só entre
duas datas), ver abaixo.

| Bloco (`type`) | Para que serve | Campos principais |
|---|---|---|
| `profile` | Foto, nome, bio, tags e redes | `header`, `socials`, `cover` |
| `cta` | Botão principal (WhatsApp ou link) | `label`, `action`, `variant`, `note`, `pulse` |
| `banner` | Aviso em destaque (nova turma, evento) | `title`, `text`, `label`, `action` |
| `concierge` | Perguntas que indicam a oferta certa | `flow`, `decide`, `variant`, `collapsed` |
| `cards` | Ofertas de `offers`, com capa e preço (sem nenhuma, o bloco não aparece) | `items`, `layout`, `eyebrow` |
| `products` | Vitrine de produtos de `catalog`, com filtro | `items`, `layout`, `filter`, `title` |
| `coupon` | Cupom de desconto (toque seleciona o código) | `code`, `label`, `expires`, `action`, `copy` |
| `link` | Um link (vira card com `image` ou `subtitle`) | `title`, `url`, `subtitle`, `image`, `icon` |
| `links` | Grupo de até 12 links | `items`, `layout`, `title` |
| `social` | Redes sociais em linha | `items` |
| `youtube` | Vídeo (carrega só ao tocar) | `videoId`, `title`, `poster` |
| `gallery` | Fotos | `images`, `title` |
| `testimonials` | Depoimentos reais de clientes | `items`, `title` |
| `faq` | Perguntas frequentes (abre e fecha sem JS) | `items`, `openFirst`, `title` |
| `text` | Texto livre ou rodapé | `title`, `body`, `variant` |
| `divider` | Linha divisória | nenhum |
| `lead` | Formulário de contato (material grátis, lista de espera) | `title`, `label`, `pedir`, `sucesso`, `entrega` |
| `pix` | QR e código Pix para copiar | `chave`, `nome`, `cidade`, `valor_cents`, `copy` |
| `agenda` | Próximos encontros, Google Agenda e arquivo `.ics` | `title`, `url`, `items` |

### Liga e desliga

Nada precisa ser apagado para sair do ar. Todo bloco aceita `enabled: false`:
ele some da página e o conteúdo fica guardado na config para religar depois.

| O que | Como ligar ou desligar |
|---|---|
| Qualquer bloco | `enabled: false` (padrão: ligado) |
| Só entre duas datas | `visivel: { de: "AAAA-MM-DD", ate: "AAAA-MM-DD" }` (hora opcional; vale o fuso `site.tz`) |
| Concierge começar fechado | `collapsed: true` no bloco `concierge` (padrão: aberto) |
| Resposta do concierge sem oferta ("Ainda não sei") | Deixe a opção sem `offer`: o final vira convite para conversar no WhatsApp. `title`, `cta` e `wa` da opção personalizam esse final (padrão: "Vamos conversar", "Falar no WhatsApp") |
| Concierge: a última resposta decide o final | `decide: "ultima"` no bloco `concierge`: vale a última resposta com `offer` ou `reason`; sem nenhuma, a 1ª (padrão `"primeira"`: só a 1ª pergunta decide) |
| Ponto verde de online no botão | `pulse: true` no bloco `cta` |
| Linha de apoio abaixo do botão | `note: "..."` no bloco `cta` (sem `note`, não aparece) |
| Primeira pergunta frequente aberta | `openFirst: true` no bloco `faq` |
| Filtro por categoria na vitrine | `filter: true` no bloco `products` |
| Botão "Copiar" no cupom | `copy: true` no bloco `coupon` (padrão: desligado) |
| Foto nas capas das ofertas | `cover.image` na oferta (sem foto, a capa é gerada com `headline` e `tag`) |
| Redes no cabeçalho | `socials: "oculto"` no bloco `profile` |
| Claro, escuro ou automático | `theme.mode` |
| Cantos | `theme.corners` (`reto`, `medio`, `redondo`) ou `theme.radius` em px |

O `npm run check` avisa se todos os blocos estiverem desligados, ou se nenhum
aparece hoje por causa das datas.

### Contato (`lead`)

Formulário na bio: sempre pede o nome, e `pedir` escolhe WhatsApp, e-mail ou os
dois. Liga a captura sozinho (não precisa mexer em `features.leads`). Sem o
banco, a página mostra o WhatsApp no lugar do formulário. Os envios ficam no
painel, em Contatos.

### Pix

A página mostra o QR e o código gerados no servidor. Nome e cidade podem ter
acento na bio; o código do banco sai sem acento. Sem `valor_cents`, quem paga
escolhe o valor. `copy: true` mostra o botão Copiar; sem ele, um toque no
código seleciona tudo.

### Agenda

Eventos futuros, com botão do Google Agenda e arquivo `.ics` em
`/agenda/<id>.ics`. A página é estática: evento passado some na publicação ou
na atualização de hora em hora. `url` do bloco é o botão de agendar (Cal.com,
Calendly).

### Contagem de cliques

`features.analytics: true` (padrão: desligado) e o banco ligado: cada botão da
bio passa por um atalho que conta o toque e manda para o destino. Os números
aparecem no painel, em Resultados. Sem o banco, os botões continuam diretos.

### Vitrine de produtos

Os produtos ficam em `catalog`, na raiz da config, separados das ofertas do
concierge. Preço sempre em centavos (`price_cents: 4990` vira R$ 49,90; `0`
vira "Grátis"). O filtro por categoria funciona sem JavaScript, até 6
categorias por vitrine.

```ts
catalog: [
  { id: "livro", title: "Meu livro", url: "https://...", price_cents: 4990, category: "Livros" },
  { id: "consultoria", title: "Consultoria", url: "https://...", price_label: "Sob consulta", category: "Serviços" },
],
blocks: [
  { type: "products", title: "Loja", filter: true },
],
```

### Cupom

```ts
{ type: "coupon", code: "BEMVINDA10", label: "10% no primeiro curso", expires: "2026-12-31",
  action: { url: "https://..." } },
```

O check avisa quando o cupom vence. Um toque no código seleciona o código
inteiro e o celular oferece a opção de copiar, sem JavaScript. Com `copy: true`
aparece também um botão "Copiar" (custa cerca de 0,1 KB de JavaScript).

## Todas as opções visuais

Esta lista é gerada de `config/opcoes.ts` (`npm run readme`). Valor fora dela
dá erro no build, com as opções válidas na mensagem.

<!-- opcoes:inicio (gerado por npm run readme, não edite à mão) -->

#### `theme.preset`

| Valor | Nome | O que faz |
|---|---|---|
| `"neutro"` | Neutro | Claro e escuro automáticos, botão preto em pílula, azul como acento. |
| `"noite"` | Noite | Escuro, com capa no topo e brilho da cor de destaque. |
| `"editorial"` | Editorial | Papel bege, título serifado, visual de revista. |
| `"vitrine"` | Vitrine | Claro e quente, pensado para mostrar produtos. |
| `"brutal"` | Brutal | Amarelo, bordas grossas e sombra dura. |
| `"vibrante"` | Vibrante | Roxo profundo com destaque forte, para criador de conteúdo. |

#### `theme.mode`

| Valor | Nome | O que faz |
|---|---|---|
| `"auto"` | Automático | Segue o claro ou escuro do celular (só em modelo com as duas paletas). |
| `"claro"` | Claro | Sempre claro. |
| `"escuro"` | Escuro | Sempre escuro. |

#### `theme.font`

| Valor | Nome | O que faz |
|---|---|---|
| `"jakarta"` | Jakarta | Plus Jakarta Sans: moderna e neutra. |
| `"serif"` | Serifada | Instrument Serif nos títulos, Jakarta no texto. |
| `"grotesk"` | Grotesk | Space Grotesk: técnica e marcante. |
| `"bricolage"` | Bricolage | Bricolage Grotesque nos títulos: expressiva. |
| `"inter"` | Inter | Inter: limpa, de interface. |
| `"manrope"` | Manrope | Manrope: geométrica e moderna. |
| `"montserrat"` | Montserrat | Montserrat: larga e firme. |
| `"poppins"` | Poppins | Poppins: redonda e amigável. |
| `"dmsans"` | DM Sans | DM Sans: simples e leve. |
| `"outfit"` | Outfit | Outfit: geométrica e jovem. |
| `"sora"` | Sora | Sora: técnica e arejada. |
| `"albert"` | Albert Sans | Albert Sans: neutra e elegante. |
| `"archivo"` | Archivo | Archivo: forte e compacta. |
| `"lora"` | Lora | Lora: serifada de leitura confortável. |
| `"playfair"` | Playfair | Playfair Display nos títulos: clássica e sofisticada. |
| `"fraunces"` | Fraunces | Fraunces nos títulos: serifada com personalidade. |
| `"syne"` | Syne | Syne nos títulos: ousada e artística. |
| `"mono"` | Mono | JetBrains Mono nos títulos: técnica, de código. |

#### `theme.titulo`

| Valor | Nome | O que faz |
|---|---|---|
| `"fino"` | Fino | Títulos leves e grandes, elegantes. |
| `"normal"` | Normal | Peso médio, equilibrado. |
| `"forte"` | Forte | Títulos bem pesados, de impacto. |

#### `theme.rotulos`

| Valor | Nome | O que faz |
|---|---|---|
| `"padrao"` | Padrão | Selos e etiquetas na fonte do texto. |
| `"mono"` | Técnico | Selos, etiquetas e rótulos em letra mono, maiúscula e espaçada. |

#### `theme.background`

| Valor | Nome | O que faz |
|---|---|---|
| `"onda"` | Onda | Degradê suave da cor de destaque no topo. |
| `"gradiente"` | Brilho | Brilho radial da cor de destaque atrás do perfil. |
| `"pontos"` | Pontos | Textura de pontos na página inteira. |
| `"liso"` | Liso | Só a cor de fundo. |

#### `theme.buttons`

| Valor | Nome | O que faz |
|---|---|---|
| `"pilula"` | Pílula | Botões totalmente arredondados. |
| `"suave"` | Suave | Botões com cantos arredondados. |
| `"contorno"` | Contorno | Botão principal vazado, só com borda. |
| `"brutal"` | Brutal | Borda grossa e sombra dura deslocada. |

#### `theme.corners`

| Valor | Nome | O que faz |
|---|---|---|
| `"reto"` | Retos | Cantos quase retos (4 px). |
| `"medio"` | Médios | Cantos arredondados (14 px). |
| `"redondo"` | Redondos | Cantos bem arredondados (22 px). |

#### `bloco "profile": header`

| Valor | Nome | O que faz |
|---|---|---|
| `"centro"` | Centro | Foto, nome e bio centralizados. |
| `"capa"` | Com capa | Faixa de capa no topo, foto sobreposta. |
| `"lado"` | Lado a lado | Foto à esquerda, nome e bio à direita. |

#### `bloco "profile": socials`

| Valor | Nome | O que faz |
|---|---|---|
| `"icones"` | Ícones | Redes como ícones redondos. |
| `"nomes"` | Com nome | Redes como pílulas com o nome. |
| `"oculto"` | Ocultas | Não mostra as redes no cabeçalho. |

#### `bloco "cards": layout`

| Valor | Nome | O que faz |
|---|---|---|
| `"carrossel"` | Carrossel | Cards lado a lado, arrastando para o lado. |
| `"lista"` | Lista | Um card por linha, capa à esquerda. |
| `"grade"` | Grade | Duas colunas, sem descrição. |
| `"destaque"` | Destaque | O primeiro card grande, os outros em linha. |

#### `bloco "links": layout`

| Valor | Nome | O que faz |
|---|---|---|
| `"lista"` | Lista | Links numa caixa, um por linha. |
| `"botoes"` | Botões | Cada link é um botão. |
| `"icones"` | Ícones | Grade de três colunas com ícone. |

#### `bloco "concierge": variant`

| Valor | Nome | O que faz |
|---|---|---|
| `"destaque"` | Destaque | Card escuro de destaque, o elemento mais forte da página. |
| `"leve"` | Leve | Card claro com borda, discreto. |

#### `bloco "concierge": decide`

| Valor | Nome | O que faz |
|---|---|---|
| `"primeira"` | Só a 1ª pergunta | A resposta da 1ª pergunta decide o final; as outras vão como contexto na mensagem. |
| `"ultima"` | A última resposta com destino | Vale a última resposta que leva para uma oferta ou tem explicação própria; sem nenhuma, vale a 1ª. |

#### `bloco "products": layout`

| Valor | Nome | O que faz |
|---|---|---|
| `"carrossel"` | Carrossel | Produtos lado a lado, arrastando. |
| `"grade"` | Grade | Produtos em duas colunas. |

<!-- opcoes:fim -->

## Painel /admin

Com o painel ligado, a bio é editada pelo navegador em `https://<seu-site>/admin`:
perfil, modelo e cores, blocos (ordem, liga e desliga, datas, adicionar,
duplicar, apagar), ofertas, vitrine, cupom, concierge, contato, Pix, agenda e
os envios do formulário, com envio de imagem. Cada publicação vira uma versão,
e dá para voltar a qualquer uma. Com a contagem ligada, a aba Resultados mostra
os toques.

Sem o painel ligado, tudo continua funcionando pelo `linkbio.config.ts`.

**Como ligar (uma vez):**

1. Crie um projeto no Supabase e rode, em ordem, os arquivos de
   `supabase/migrations/` (tabelas do painel, rascunho e pasta de imagens;
   nada fica aberto ao público).
2. Preencha no `.env.local` e na Vercel: `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY` e `ADMIN_SESSION_SECRET` (o Claude gera o segredo
   com `npm run admin:segredo` e abre o `.env.local` no seu editor de texto para
   você colar as chaves do Supabase; elas não passam pelo chat).
3. Cadastre quem pode entrar: o Claude roda `npm run admin:usuario -- voce@email.com`
   (sem senha no comando, uma senha forte é gerada) e abre a senha num arquivo de
   texto para você guardar; ela não aparece na conversa. O mesmo comando troca a senha.
4. Publique. Entre em `/admin/login`.

**Regras do painel:**

- Cada edição vira um rascunho automático, e a prévia ao lado mostra o
  rascunho em tempo real. Nada vai ao ar até clicar em **Publicar**;
  **Descartar** volta ao que está publicado.
- Publicar valida com as mesmas regras do `npm run check`: config com erro não
  é publicada, e o painel mostra o campo e o motivo.
- A versão publicada fica no banco. O `linkbio.config.ts` vira o ponto de
  partida e a reserva: se o banco estiver fora do ar, a bio usa o arquivo.
- Login com código de 6 dígitos no e-mail (vale 10 minutos). Quem já tem senha
  continua entrando com ela. 5 tentativas erradas bloqueiam o e-mail por 15
  minutos. O painel não aparece no Google.
- Em Versões, **Arquivo original** > Restaurar volta ao conteúdo do
  `linkbio.config.ts` (publicado como versão nova; o histórico fica).
- Imagens: JPG, PNG, WebP ou GIF, até 4 MB.

## Configuração local

```bash
cp .env.example .env.local
```

O `.env.local` nunca vai para o git. Todas as variáveis são opcionais: sem elas,
a bio funciona estática (links, WhatsApp e concierge em modo roteiro). As do
painel (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SESSION_SECRET`) estão
na skill `ligar-painel`. `CRON_SECRET` (opcional) protege `/api/keepalive`.

## Capa ao compartilhar

Quando você manda o link da bio no WhatsApp, Instagram ou Telegram, aparece uma
capa com sua foto, nome, @ e bio, no visual do modelo. Quer outra? No painel, em
Contato e site > Capa ao compartilhar, envie uma imagem (1200 x 630; outra
proporção é recortada) e, se quiser, o título e o texto do link. Cada um é
opcional. A capa sai em JPG abaixo de 300 KB, porque acima disso o WhatsApp não
mostra a capa grande. O WhatsApp guarda a prévia de cada link por um tempo: para
ver a nova na hora, mande o link com um final diferente (ex.: `?c=2`).

## Supabase sempre ativo

No plano grátis, o Supabase pausa o projeto depois de 7 dias sem uso, e a bio
volta ao conteúdo do `linkbio.config.ts`. Para evitar isso:

1. Rode a migration `supabase/migrations/0003_keepalive.sql` (SQL Editor ou
   `npx supabase db push`).
2. Publique na Vercel. O `vercel.json` já traz uma cron diária (`0 12 * * *`,
   dentro do limite do plano gratuito) que chama `/api/keepalive` e grava só um
   horário numa tabela própria, sem mexer no conteúdo.

Opcional: defina `CRON_SECRET` nas variáveis da Vercel (`openssl rand -base64 32`)
para a rota aceitar só a chamada da própria cron. Sem ela também funciona.

## Como validar

Antes de publicar, rode:

```bash
npm run check
```

O check valida a config, confere as envs e roda os testes. Só considere
"pronto" com ele verde.

## WhatsApp de exemplo

Os exemplos do template usam o número fictício `5511987654321`. Troque pelo seu
número (só dígitos, com DDI) durante o setup.

## Créditos

Template criado pela VAMOO AI para seus mentorados. "Vamoo" aparece só neste
README: o gate do zip (`scripts/zip-gate.sh`) reprova o pacote se encontrar a
marca em qualquer outro arquivo.
