---
name: setup-linkbio
description: Primeira configuração da bio, e o primeiro contato da pessoa com o template. Use quando a pessoa acabou de baixar o template, disser "oi" com a bio ainda no exemplo (Marina Duarte), "rode o setup da minha bio", "quero montar minha bio", "por onde começo" ou "configurar a bio". Lê o Instagram, o site e a bio atual da pessoa, escreve a bio inteira na voz dela, valida e abre a prévia. Depois do setup, qualquer mudança é editar-bio.
---

# Setup da bio

Objetivo: do "oi" à prévia aberta, com a bio escrita na voz da pessoa e `npm run check` verde, em
até 15 minutos: 5 perguntas, a escolha do visual e uma confirmação. Siga "Como falar com a pessoa" do `AGENTS.md`.

## 1. Boas-vindas e instalação (em paralelo)

- Uma frase: "Vou montar sua bio lendo seu Instagram e seu site, para ela já sair com a sua cara.
  São 5 perguntas rápidas e, no fim, você confere o que eu entendi."
- Só no Windows, antes de tudo: o Claude roda os comandos pelo Git Bash, que vem com o Git.
  Confira com `git --version`. Se faltar: `winget install --id Git.Git -e
  --accept-source-agreements --accept-package-agreements` (ela clica em Sim). Sem `winget`: peça
  para ela abrir git-scm.com no navegador, clicar em Download for Windows, abrir o arquivo baixado
  e clicar em Next até o fim. Depois: "Feche o app do Claude por completo e abra de novo nesta
  mesma pasta. Depois me escreva: continua."
- Lugar da pasta:
  `pwd | grep -ciE "onedrive|Mobile Documents|iCloud|Downloads|^$HOME/(Documents|Desktop)"`.
  Deu 1: a pasta está numa nuvem que sincroniza, em Downloads (costuma ser limpa) ou em
  Documentos/Mesa (no Mac, com "Mesa e Documentos no iCloud" ligado, o caminho não mostra iCloud,
  mas sincroniza). Explique em uma frase e peça para mover a pasta `linkbio` inteira para a pasta
  pessoal (Mac: Finder > Ir > Pasta Pessoal, fica `~/linkbio`; Windows:
  `C:\Users\<nome>\linkbio`), abrir a pasta nova no app do Claude e escrever "continua".
- `node -v` precisa ser 22.12 ou mais novo (22, 24 ou 26 em diante servem; 23 e 25 não). Sem Node
  ou versão velha, você instala; ela só clica. Diga antes: "Preciso instalar o Node, o programa
  que roda a sua bio no computador. Vai abrir um instalador: é só clicar."
  - **Mac:** `bash scripts/instalar-node.sh`. Ele baixa o instalador oficial, confere o checksum e
    só abre se bater. Respondeu `ABERTO`: diga "Abriu o instalador do Node. Clique em Continuar
    até o fim e digite a senha do Mac quando ele pedir. Me avise quando aparecer 'A instalação foi
    concluída'." e confira com `/usr/local/bin/node -v`.
  - **Windows:** `winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements
    --accept-package-agreements`. Avise: "O Windows vai perguntar se o programa pode fazer
    alterações: clique em Sim." Sem `winget`: `bash scripts/instalar-node.sh`; respondeu `ABERTO`,
    ela clica em Next até o fim.
  - Respondeu `DIFERENTE`, `SEM CHECKSUM` ou `FALHOU O DOWNLOAD`: nunca abra o arquivo por conta
    própria. Rode o script de novo uma vez; se repetir, conte em uma frase que o download não
    passou na conferência e peça para ela tentar mais tarde ou baixar a LTS em nodejs.org.
  - Se depois disso `node -v` ainda não responder (comum no Windows): "Feche o app do Claude por
    completo e abra de novo nesta mesma pasta. Depois me escreva: continua." A conversa recomeça
    e o setup segue de onde parou (o que já foi gravado fica).
- Sem `node_modules/`: rode `npm install && npx playwright install chromium` em segundo plano e
  siga perguntando enquanto instala (o navegador de teste fotografa o site para o visual sair fiel).
- Sem `.env.local`: `cp .env.example .env.local`.

## 2. Cinco perguntas

Uma por vez. Não invente nada.

1. Nome que aparece na bio (pessoa ou empresa).
2. "Qual é o @ do **seu** Instagram?" (só se lê o perfil da própria pessoa ou da empresa dela).
3. "Seu site, se tiver?" (pode ser nenhum; só o site dela).
4. WhatsApp com DDD (vira `55` + DDD + número, só dígitos).
5. Endereço da bio. Explique: "Sua bio vai ter um endereço grátis, assim: **seunome.vercel.app**.
   Que nome você quer? (Se você já tem um domínio, tipo seunome.com.br, me diga também: ele entra
   depois de publicar.)" Proponha 2 opções a partir do @ ou do nome (ex.: @ana.nutri →
   `ana-nutri` ou `ananutri`). Regras do nome: 3 a 40 caracteres, só letras minúsculas sem acento,
   números e hífen, começando e terminando com letra ou número (ponto e _ do @ viram hífen). Grave
   em `site.url` como `https://<nome>.vercel.app`. Se ele estiver ocupado na Vercel, a skill
   `publicar` acerta na hora. O domínio próprio, se houver, só entra depois (skill `publicar`, parte
   "Domínio próprio"): anote e lembre no fim.

Depois, só se ela deu um site: "Quer a bio **100% fiel** ao seu site (mesmas cores e fonte) ou uma
**sugestão de upgrade** (mesma marca, mais legível e moderna)?"

## 3. Acesso ao Instagram

Rode `grep -c '^APIFY_TOKEN=[A-Za-z0-9_-]\{20,\}' .env.local` (só conta, não mostra nada).

- **Deu 1 ou mais:** siga para o passo 4.
- **Deu 0:** o token nunca passa pelo chat. Explique que ele é a chave da conta Apify dela e
  guie a criação (`referencias/analise.md` > "Token da Apify"). Depois siga "Segurança" do
  `AGENTS.md`: garanta a linha vazia `APIFY_TOKEN=` no `.env.local`, abra o arquivo no editor de
  texto, ela cola e salva, e você confere só com
  `grep -c '^APIFY_TOKEN=[A-Za-z0-9_-]\{20,\}' .env.local`. Nunca mostre o valor.
- Sem conta, ou se ela preferir não fazer agora: modo manual (ela manda aqui na conversa 3 a 5
  legendas que escreveu). Nunca trave: sem token, siga no modo manual.

## 4. Coletar

Avise que leva de 1 a 3 minutos e rode com tempo limite de 10 minutos (no Claude Code, timeout
600000):

`npm run analisar -- --instagram <@> [--site <site>]`

O comando grava em `analise/` (fora do git), apaga o que sobrou de uma rodada anterior e acha
sozinho a bio atual (Linktree e afins). Se ele disser que o perfil aponta para um site que ela não
citou (`analise/site-sugerido.json`), pergunte se é dela antes de ler
(`npm run analisar -- --site <url>`). Falha em uma parte não para as outras. Avisos de perfil
privado, poucas legendas ou site que precisa de navegador: siga o que o próprio aviso diz.

## 5. Entender e confirmar (uma mensagem só)

Leia `analise/*.json` e siga `referencias/analise.md` para escrever `analise/voz.md` e
`analise/visual.md`. Mostre em linguagem normal, curto:

- "Você vende/oferece: X, Y e Z" (com preço só se apareceu nas fontes).
- "Você fala assim:" e 2 frases reais dela.
- "Seus links de hoje:" (de `links.json`; sem ele, os links do perfil em `instagram.json`).
- O visual em uma linha: modelo, cor, fonte (com site: o fiel ou upgrade que ela escolheu; sem site:
  1 ou 2 opções para ela escolher aqui mesmo, ver "Visual" na referência).
- O WhatsApp que ela deu, para conferir.
- A foto do Instagram como foto da bio (se baixou). Sem foto, ou se ela preferir: o logo do site
  (`analise/logo.*`).
- Só se houver, junto na mesma mensagem: posts em parceria escritos por outra conta ("é você quem
  escreve em @autor?"); outra conta de Instagram nos links ("@conta também é sua? entra nas redes do
  topo?"); serviço citado só na bio ou nas legendas, sem página ("vira oferta com botão de
  WhatsApp?").

Pergunte: "Está certo? Me diga o que corrigir ou tirar." Ajuste até ela dizer que está bom.

## 6. Escrever

- Só `linkbio.config.ts` e `public/`. Regras de campo (preço em centavos, ids, foto):
  `editar-bio/referencias/campos.md`. Foto aprovada: copie `analise/foto.jpg` para
  `public/avatar.jpg` (ou o logo aprovado para `public/avatar.png`) e aponte `profile.avatar`.
- Troque TODO o conteúdo do exemplo. Bloco do exemplo sem equivalente real (depoimentos, FAQ,
  banner, cupom, vídeo, galeria, produtos, links de `exemplo.com`) sai da config. Frase do exemplo
  que afirma algo sobre a pessoa também sai, mesmo em bloco que fica: o `note` e o `pulse` do botão
  principal ("Respondo pessoalmente..." e o ponto de online), o `eyebrow` dos cards.
- Textos na voz dela, seguindo `analise/voz.md`: bio do perfil, `why` das ofertas, botões,
  mensagens do WhatsApp, concierge e `site.share`. Reaproveite frases dela sempre que der.
- Concierge: com 2 ofertas ou mais, adapte às ofertas dela (`editar-bio/referencias/concierge.md`);
  com uma oferta só, apague o bloco; sem oferta nenhuma, mantenha só se ela quiser triar quem chega,
  com respostas sem `offer` (levam ao WhatsApp). Uma pergunta basta; não invente uma segunda só
  porque o exemplo tem duas.
- `theme` conforme `analise/visual.md`. Não copie `font` nem `radius` do exemplo.
- `site.url`: `https://<nome>.vercel.app`, com o nome da pergunta 5.

## 7. Validar e mostrar

Antes de mostrar, confira o visual com `npm run foto` (referência, "Visual", passo 7).
Siga "Validar e mostrar" do `AGENTS.md` (o aviso da foto padrão é esperado se ela ainda não mandou
foto: explique em uma frase). Pergunte o que mudar e repita.

Pronto só com check verde. Ofereça em seguida: colocar no ar no endereço escolhido (skill
`publicar`). Se ela tem domínio próprio, lembre que ele entra logo depois de publicar.
