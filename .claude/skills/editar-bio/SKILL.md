---
name: editar-bio
description: Qualquer mudança na bio já configurada, de conteúdo ou de visual. Conteúdo: links, ofertas, preço, produto, cupom, WhatsApp, foto, textos, vídeo do YouTube, galeria, FAQ, depoimentos, banner, concierge, formulário de contato, Pix, agenda, datas de um bloco, pixel, contagem de cliques. Visual: modelo, cor, claro ou escuro, fonte, fundo, botões, cantos, jeito de um bloco aparecer. Use quando a pessoa pedir "adiciona o link do...", "muda o preço", "troca minha foto", "põe meu vídeo", "tira esse bloco", "muda o concierge", "formulario de contato", "chave Pix", "agenda", "some depois do dia 10", "muda a cor", "deixa escuro", "quero mais séria", "o botão está feio", ou quando ela editar e o site não mudar.
---

# Editar a bio

## 1. Onde editar

Siga "Arquivo ou painel" do `AGENTS.md`.

- **Painel:** guie a pessoa clique a clique pela coluna "No painel" até **Publicar**. Ofereça
  ficar junto enquanto ela faz. Não edite o arquivo.
- **Arquivo:** edite `linkbio.config.ts` (e `public/` para imagens), valide, e ofereça a skill
  `publicar` para subir.

## 2. Pedido → onde fica

| Pedido | No arquivo | No painel |
|---|---|---|
| Nome, bio, temas, redes do topo | `profile` | Perfil (setas nos temas mudam a ordem) |
| Foto | arquivo em `public/` + `profile.avatar` | Perfil > Foto |
| WhatsApp, endereço do site | `contact.whatsapp`, `site.url` | Contato e site |
| Capa do link no WhatsApp | `site.share` (`image` 1200 x 630, `title`, `description`); vazio = capa automática com foto, nome e bio | Contato e site > Capa ao compartilhar |
| Botão principal | bloco `cta` | Blocos |
| Um link / vários links | bloco `link` / `links` (até 12) | Blocos > Adicionar bloco (entra no fim; ver "Mudar a ordem") |
| Oferta (título, texto, preço, botão, capa) | `offers[]` | Blocos > Ofertas (abre o card) |
| Quais ofertas aparecem nos cards | bloco `cards`, `items` | Blocos > Ofertas |
| Produto da vitrine | `catalog[]` + bloco `products` | Vitrine (ordem: Blocos > Vitrine, setas) |
| Cupom, aviso em destaque | bloco `coupon`, `banner` | Blocos |
| Vídeo, fotos, depoimentos, perguntas frequentes | bloco `youtube`, `gallery`, `testimonials`, `faq` | Blocos > Adicionar bloco (entra no fim; ver "Mudar a ordem") |
| Texto livre, rodapé, linha divisória | bloco `text`, `divider` | Blocos > Adicionar bloco (entra no fim; ver "Mudar a ordem") |
| Concierge (perguntas e para onde leva) | bloco `concierge` | Blocos > Concierge |
| Apagar oferta | tirar de `offers` e das referências (cards, concierge) | Ofertas > lixeira > Apagar (sai sozinha dos cards; se a 1ª pergunta do concierge levava a ela, escolha outra em "Leva para") |
| Mudar a ordem, duplicar ou apagar bloco | ordem em `blocks[]` | Blocos > "..." da linha (Subir, Descer, Duplicar, Apagar com confirmação); no computador, arrastar pela alça |
| Formulário de contato (material, lista de espera) | bloco `lead` | Blocos > Adicionar bloco > Contato; envios em Contatos |
| Pix (QR e código) | bloco `pix` | Blocos > Adicionar bloco > Pix |
| Agenda (encontros, Google Agenda, arquivo) | bloco `agenda` | Blocos > Adicionar bloco > Agenda |
| Só entre duas datas | `visivel.de` / `visivel.ate` no bloco | abra o bloco > "Mostrar só entre datas" |
| Contagem de cliques | `features.analytics: true` | Contato e site (números em Resultados) |
| Pixel da Meta / Google Analytics | `features.pixel` | Contato e site > Medição de visitas |
| Esconder sem apagar | `enabled: false` no bloco | a chave ao lado do bloco (mostra "Na bio" ou "Escondido") |
| Modelo, cor, fonte, fundo, botões, cantos | `theme` | Aparência (fonte diferente nos títulos e no texto: Fonte > Títulos e texto separados) |
| Jeito de um bloco aparecer (carrossel, lista, capa) | campo do bloco | Blocos (clique em qualquer ponto da linha do bloco) |

Todos os 19 tipos de bloco já existem. Pedido que cabe num deles NÃO é `novo-bloco`.

## 3. Referências (leia só quando o pedido tocar nelas)

- `referencias/campos.md`: preço em centavos, ids, foto e imagens, ofertas, links, contato,
  Pix, agenda, datas do bloco, pixel e cliques. Leia antes de editar oferta, produto, foto,
  link, formulário, Pix, agenda ou medição.
- `referencias/visual.md`: modelos, cores, fontes e variantes de cada bloco. Leia para pedido de
  visual.
- `referencias/concierge.md`: regra das perguntas e respostas.

## 4. Validar

Siga "Validar e mostrar" do `AGENTS.md`. Mudança de visual com modo automático: mostre no claro e
no escuro. Depois, ofereça colocar no ar (skill `publicar`).

Se a pessoa diz que "mudou e o site não mudou":
- No painel: ela clicou em Publicar? As 3 variáveis do painel estão na Vercel, com Redeploy depois
  delas (skill `publicar`, passo 4)? Sem elas, o site no ar lê o arquivo. Recarregue a página.
- No arquivo: a mudança foi enviada (skill `publicar`, "Mudanças depois")?
