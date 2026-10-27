# Regras de campo (linkbio.config.ts)

Nunca mostre estes nomes à pessoa: use para acertar a config.

## Preço
- Em centavos: R$ 97 = `price_cents: 9700` (escrever `97` mostraria R$ 0,97). Pergunte em reais
  e converta.
- Sem preço: apague o campo. `0` aparece como "Grátis".
- No painel o preço é digitado em reais, do jeito que a pessoa escreve (1.290,50 ou 1290.50).

## Ofertas e produtos
- Oferta nova precisa de `id` (minúsculas e hífens, ex.: `consulta-online`), `title`, `why` e um
  destino: `url` (link) ou `wa` (mensagem de WhatsApp). Com os dois, o botão abre o `url`; o `wa`
  só vale sem `url`. `more_url` é o link opcional "saiba mais".
- Capa do card (opcional, `cover`): `image` (arquivo em `public/`), `headline` (até 60 caracteres,
  `\n` quebra a linha), `tag` (até 24) e `tone` (`escuro`, `claro` ou `gradiente`).
- Para aparecer nos cards, o `id` entra no `items` do bloco `cards`. Produto: `catalog[]` e o `id`
  no `items` do bloco `products`.
- Apagar oferta ou produto: tire antes o `id` dos blocos `cards`, `products` e das respostas do
  concierge. O check aponta o que ficou para trás.
- Bio sem oferta vale: `offers: []` (ou sem o campo). Bloco `cards` vazio não aparece na página;
  resposta do concierge sem `offer` leva ao WhatsApp.

## Perfil
- `profile.handle` começa com `@`.
- `profile.tags`: até 5; sem temas, `tags: []` (o campo não pode sumir).
- `profile.tipo`: `pessoa` (padrão, pode omitir) ou `empresa`. Empresa faz o Google ver a bio como organização e usa a foto como logo. No painel: Perfil, "Pessoa ou empresa".
- `profile.socials`: até 8. As redes também entram no dado estruturado da página (sameAs).

## Medição de visitas (pixel)
- `features.pixel.meta`: só números, de 10 a 20. Vazio ou ausente: a bio não carrega o Pixel da Meta.
- `features.pixel.ga4`: começa com `G-` e segue com letras ou números (ex.: `G-AB12CD34`). Vazio: não carrega o Google Analytics.
- `features.pixel.clarity`: ID do projeto no Microsoft Clarity (de 6 a 20 letras minúsculas ou números; em Settings, Setup). Mostra onde as pessoas tocam e até onde rolam, com gravação das visitas. Vazio: não carrega o Clarity.
- `features.pixel.claritySemCookies` (padrão `true`): o Clarity grava desde a entrada sem cookies (consentimento negado, um ID novo a cada página) e passa a usar cookies só depois do Aceitar. Quem recusa continua gravado sem cookies. O texto do aviso muda para "Se você recusar, nada fica guardado no seu aparelho". `false`: o Clarity espera o aceite, como o Pixel e o GA4. Sem o modo sem cookies, quem chega pelo navegador do Instagram quase nunca aceita e o Clarity não vê essas visitas.
- Depois do aceite, a bio marca sozinha: `Contact` no toque no WhatsApp, `Lead` no envio do bloco lead e na reserva do agendamento (com eventID) e, no Clarity, um evento `toque_<botão>` por toque contado.
- Os três são opcionais. Com algum preenchido, a bio mostra um aviso de cookies e só carrega o script depois do aceite. Recusar fica gravado no navegador.
- No painel: Contato e site, "Medição de visitas". O número da Meta está no Gerenciador de Eventos (Fontes de dados). O do Google está em Administrador, Coleta de dados, Fluxos de dados, ID de medição.
- `META_PIXEL_ID`, `GA4_MEASUREMENT_ID` e `CLARITY_PROJECT_ID` no ambiente só valem se o campo da config estiver vazio. ID que não parece ID vira aviso no check e não carrega script.
- `contact.whatsapp`: só dígitos, com 55 e DDD (ex.: `5511987654321`). No painel pode digitar com
  parênteses e espaços: ele tira os símbolos e põe o 55.

## Google e Bing (`site.verificacao`)
- `site.verificacao.google`: código da tag `google-site-verification` do Google Search Console (propriedade "Prefixo do URL" com o endereço da bio, método "Tag HTML"). Pode colar a tag inteira: a bio guarda só o código.
- `site.verificacao.bing`: código da tag `msvalidate.01` (32 caracteres). Mais simples: no Bing Webmaster Tools, importar o site do Google Search Console, sem código.
- Ordem: põe o código, publica, e só então clica em Verificar no Google. Depois, em Sitemaps, envie `sitemap.xml`.
- No painel: Contato e site > Site > Avançado. A página sempre aponta o canonical para a home de `site.url`: o link com `?src=` ou `utm_` não vira página duplicada.

## Cartão do link ao compartilhar (`site.share`)
- Tudo opcional. Sem nada: capa automática com foto, nome, @ e bio.
- `title` até 70 caracteres (padrão: nome e @); `description` até 200 (padrão: a bio); `image` em
  `public/`, ideal 1200 x 630.

## Foto e imagens
- Só imagem do próprio repo (`public/`) ou enviada pelo painel. Link de imagem de outro site
  (Instagram, Google, Drive) quebra a página: peça o arquivo à pessoa e salve em `public/`.
- JPG, PNG ou WebP (o painel aceita GIF também). HEIC do iPhone precisa virar JPG (no Mac:
  `sips -s format jpeg foto.heic --out public/foto.jpg`).
- No arquivo: salve em `public/` com a extensão real e use o caminho começando com `/`
  (ex.: `/avatar.jpg`). Pelo painel: foto acima de 4 MB é reduzida sozinha; GIF só até 4 MB.

## Bloco de contato (`type: "lead"`)
- Liga a captura sozinho: não precisa de `features.leads`.
- Sempre pede o nome. `pedir`: `"whatsapp"`, `"email"` ou `"ambos"`.
- `label` é o texto do botão. `sucesso` é a frase depois de enviar.
- `entrega.url` (opcional, https) é o link do material, mostrado depois do envio.
- `consentimento` é o texto curto da caixa de concordância. Se faltar, o check usa um texto padrão.
- Sem o banco (Supabase) ligado, o check acusa e a página mostra só o botão de WhatsApp.
- Os envios aparecem no painel, na seção Contatos, com botão para baixar a planilha.

## Links e blocos
- Todo link externo começa com `https://`.
- Bloco `links`: até 12 itens.
- Cupom: `code` em MAIÚSCULAS, números, `-` ou `_` (2 a 30, sem espaço), `label` e, se tiver
  validade, `expires` em AAAA-MM-DD.
- Pix: `chave` (CPF ou CNPJ só com dígitos, e-mail, telefone `+55` e DDD, ou chave aleatória
  com hífens), `nome` até 25 e `cidade` até 15. Acento no nome ou na cidade vira aviso do check:
  o código do banco sai sem acento. `valor_cents` opcional, em centavos (R$ 49,90 = `4990`);
  sem valor, quem paga escolhe. `txid` opcional, letras e números até 25 (sem espaço nem acento);
  vazio vira `***`. `copy: true` mostra o botão Copiar; sem ele, um toque no código seleciona tudo.
  No painel a pessoa pode colar a chave com ponto e traço: ele tira.
- Agenda: `items` com `id` (minúsculas e hífens, único, vira o arquivo `/agenda/id.ics`), `title`,
  `date` em AAAA-MM-DD, `time` opcional em HH:MM, `duration` opcional em minutos, `place` (texto ou
  link `https`) e `description` curta. Usa `site.tz`. Evento que já passou some da página na
  próxima publicação ou na atualização de hora em hora (a página é estática). Se todos passaram,
  o check avisa. `url` opcional do bloco é o botão de agendar (Cal.com, Calendly). Sem `duration`,
  o Google Agenda marca uma hora; o arquivo .ics não inventa duração.
- Agendamento (horários livres do Google Agenda): `servicos` com `id`, `title` (até 40) e `duracao`
  em minutos de 5 em 5 (15 a 480); `subtitle` opcional. Regra, tudo opcional: `dias` (`"seg"` a
  `"dom"`; padrão seg a sex), `inicio` e `fim` em HH:MM (padrão 09:00 e 18:00), `pausas` com
  `inicio` e `fim` (ex.: almoço), `antecedencia` em horas (padrão 12), `janela` em dias (padrão 14),
  `intervalo` em minutos antes e depois de cada compromisso (padrão 15), `passo` (padrão 30) e
  `maxPorDia`. `local` (endereço ou link) troca o Meet; vazio, cada horário ganha um Meet.
  `pedirEmail: true` pede e-mail e manda o convite. Pergunte durações e horários à pessoa; não
  invente. Para funcionar precisa do banco e do Google ligados (skill `ligar-agenda`); sem eles, o
  bloco vira botão de WhatsApp e o check avisa.
- Vídeo do YouTube: no arquivo, `videoId` é o código depois de `v=` no link (ou depois de
  `youtu.be/`). No painel, cole o link inteiro: ele guarda só o código.
- Esconder sem apagar: `enabled: false`.
- Mostrar só entre datas: `visivel` em qualquer bloco, `{ de?: "AAAA-MM-DD" ou "AAAA-MM-DDTHH:MM", ate?: o mesmo }`. Vale no fuso `site.tz` (padrão América/São Paulo). Sem hora, `de` começa à meia-noite e `ate` inclui o dia inteiro. `de` não pode ser depois de `ate`. No painel: abra o bloco e use "Mostrar só entre datas". Fora do prazo o bloco some da bio; na prévia ele continua, com o selo, e a linha mostra "Programado" ou "Expirado".
- Campos de cada bloco: tabela "Blocos" do `README.md`.

## Conteúdo por origem (`origem` em qualquer bloco)
- `origem: { mostrar: ["stories"] }`: o bloco só aparece para quem chegou com `?src=stories`
  (ou `utm_source=stories`). Quem chega sem origem não vê.
- `origem: { esconder: ["bio"] }`: o bloco some só para quem veio da bio.
- Para trocar o título ou o botão do topo por origem, duplique o bloco: um com `mostrar` da origem
  e o original com `esconder` da mesma origem.
- Origem: de 1 a 20 letras minúsculas, números ou hífen. "direto" não vale (é quem chega sem origem).
  A mesma origem não pode estar em `mostrar` e em `esconder`.
- A origem fica guardada na sessão: quem chegou pelos stories e recarrega continua vendo a versão dos stories.
- A página continua a mesma para o Google (canonical na home). Sem JavaScript, vale a versão sem origem.
- O lead e o agendamento gravam a origem e a campanha (`utm_*`, `fbclid`) junto do contato, e o
  aviso por e-mail ou webhook diz de onde a pessoa veio.
- No painel: abra o bloco > Avançado > "Mostrar conforme a origem do link". A prévia mostra todos os blocos.

## Contagem de cliques (`features.analytics`)
- `false` por padrão. Com `true` e o banco ligado (painel), cada botão da bio passa por um atalho
  nosso que conta o toque e manda para o destino. Sem o banco, o check só avisa e os botões
  continuam diretos: a bio não quebra.
- A pessoa vê os números na seção Resultados do painel (7 e 30 dias, por botão e por origem).
  Links para copiar: a bio com `?src=bio`, `?src=stories` e `?src=reels`.
- Com a contagem ligada, a bio também conta visitas por origem (uma por sessão do navegador, sem
  cookie). Resultados mostra, por origem, visitas, toques e "toques por visita" dos últimos 30 dias.
  Precisa da migration `0010_origem.sql` no banco; sem ela os cliques continuam e as visitas ficam zeradas.
- A origem é o `?src=` do link, ou o `utm_source` quando não há `src` (link de anúncio).
- Bloco sem `id`: a contagem usa o tipo e a posição. Mudar a ordem muda a chave e o histórico
  daquele botão recomeça. Com `id`, a chave fica estável. Não mostre esses nomes à pessoa.
