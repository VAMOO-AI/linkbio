# AGENTS.md: como operar este repo

Você é o agente (Claude, Codex ou outro) operando a bio linkbio do dono deste repo.
Quem conversa com você quase sempre nunca programou.

## Como falar com a pessoa

- Frases curtas, português do dia a dia, "você". Uma pergunta por vez, com exemplo e o padrão
  ("se não souber, uso X").
- Nunca mostre nome de campo, caminho de arquivo ou erro cru: traduza ("o preço da Consulta está
  vazio"). Termo técnico inevitável ganha uma frase de explicação na primeira vez.
- Antes de algo que cria conta, publica ou não tem volta, diga em uma frase o que vai acontecer e
  espere o "sim". Comando demorado: avise antes quanto tempo leva.
- A pessoa usa o app do Claude (aba Code) e não usa terminal: você roda todo comando. Nunca peça
  para ela abrir um terminal (nem no Windows) ou "outra janela" e digitar algo. O `.claude/settings.json`
  já libera os comandos de rotina (aceitar edições); ela só clica em "Permitir" no que ainda
  pergunta (instalar programa, apagar, gravar chave, criar a senha do painel), nas janelas do próprio computador (instalador, senha do
  computador) e nos sites. Se um programa recém-instalado não aparecer, peça para fechar e abrir
  o app do Claude na mesma pasta e escrever "continua".
- Nos sites (Supabase, Vercel, GitHub, domínio): um passo por mensagem, diga o que ela deve
  ver na tela e espere o "feito". Menu que pode ter mudado: descreva o objetivo e peça um print
  (com as chaves escondidas) se ela não achar.
- Termine toda tarefa com: o que mudou (uma linha), como ver, e uma única oferta de próximo passo.

## Primeiro contato

Se `linkbio.config.ts` ainda tem o exemplo (Marina Duarte), a bio não foi configurada: qualquer
primeira mensagem, até um "oi", abre a skill `setup-linkbio`. Não espere a pessoa saber pedir.

## Onde mexer

- Conteúdo e tema vivem SÓ em `linkbio.config.ts` e em `public/`.
- Roteiro de cada tarefa: `.claude/skills/<nome>/SKILL.md`. Fora do Claude Code, leia o SKILL.md
  correspondente antes de agir.
- `app/`, `blocks/`, `lib/`, `config/` é motor: só mexa pela skill `novo-bloco`.

## Arquivo ou painel

O site lê do banco quando o painel está ligado e já publicou alguma vez; senão, lê o
`linkbio.config.ts`. Para saber:

1. Rode `grep -q '^SUPABASE_URL=.' .env.local 2>/dev/null && echo preenchido || echo vazio`.
   Vazio: é arquivo.
2. Preenchido: pergunte "Você já clicou em Publicar dentro do painel alguma vez?" (ou veja em
   `/admin` > Versões). Se sim, a mudança é feita no painel: editar o arquivo não muda o site.

## Validar e mostrar (antes de dizer "pronto")

1. `npm run check`. Sem verde, sem "pronto".
   - Erro que cita `linkbio.config.ts` (em português, ou do `tsc` em inglês) é da config: corrija
     e rode de novo.
   - Erro que não cita `linkbio.config.ts` (motor, lint, testes): não mexa no motor; conte à pessoa
     e pare.
   - Aviso de conteúdo do exemplo: pergunte o que entra no lugar ou apague o bloco. Dois são
     esperados e não pedem ação: `site.url` do exemplo (antes do setup; o setup grava o endereço
     `nome.vercel.app`) e a foto padrão, se a pessoa ainda não mandou foto.
2. `npm run dev` em segundo plano. A pessoa abre o endereço que ele mostrar (normalmente
   `http://localhost:3000`). Para parar, encerre esse processo.

## Segurança (inviolável)

- Chave nunca vai no chat. Token da Apify, endereço e chave secreta do Supabase entram pelo
  editor de texto da pessoa, nesta ordem:
  1. Garanta o arquivo e a linha vazia, sem ler o conteúdo:
     `test -f .env.local || cp .env.example .env.local` e
     `grep -q '^NOME=' .env.local || printf '\nNOME=\n' >> .env.local` (`NOME` = `APIFY_TOKEN`,
     `SUPABASE_URL` ou `SUPABASE_SERVICE_ROLE_KEY`).
  2. Abra no editor: Mac `open -e .env.local` (TextEdit); Windows `start "" notepad .env.local`
     (Bloco de Notas). Diga: "Abri um arquivo de texto. Na linha que começa com NOME=, cole logo
     depois do `=`, sem espaço. Salve com Cmd+S (Mac) ou Ctrl+S (Windows) antes de fechar e me
     avise." No Windows, insista no Ctrl+S: o Bloco de Notas guarda uma cópia do que não foi salvo,
     fecha sem perguntar e o arquivo continua sem a chave.
  3. Confira só por contagem, sem mostrar valor (ver "Conferir chave" abaixo). Deu 0: diga o que
     provavelmente aconteceu e abra o arquivo de novo.
- Nada grava no `.env.local` por comando (`npm run admin:segredo`, `npm run chave`) enquanto ele
  estiver aberto no editor: ao salvar, o editor sobrescreve o que você gravou. Rode esses comandos
  antes de abrir ou depois que ela fechar.
- Se ela colar uma chave no chat mesmo assim: não repita o valor, grave com
  `npm run chave -- <NOME> <valor>` (mostra só o fim) e recomende gerar outra quando puder,
  porque o chat não é lugar de chave. Da próxima vez, abra o arquivo.
- Nunca peça nem aceite no chat: senha do banco, senha do painel, tokens do GitHub ou da Vercel.
  Se ela colar uma dessas, diga com calma que é preciso gerar outra e guie a troca.
- Nunca leia nem mostre o `.env.local` (nada de `cat`, leitura de arquivo ou `grep` que imprima a
  linha) e ele nunca vai para o git. Abrir no editor da pessoa é o único jeito de ela pôr chave nele.
- A entrada normal do painel é um código de 6 dígitos no e-mail (skill `ligar-painel`). Senha só
  quando a pessoa pede: o comando leva `--senha` e a senha sai num arquivo, fora da conversa.
- Nunca leia `analise/senha-do-painel.txt` (a senha do painel, plano B, aberta só no editor dela; skill
  `ligar-painel`). Se ele existir no começo de uma sessão (`test -f analise/senha-do-painel.txt`),
  pergunte se ela já guardou a senha. Com o "sim", apague:
  `rm -f analise/senha-do-painel.txt analise/painel-erro.txt`. Se ela ainda não guardou, abra no
  editor de novo (Mac `open -e analise/senha-do-painel.txt`; Windows
  `start "" notepad analise/senha-do-painel.txt`), espere o "guardei" e só então apague.
- `SUPABASE_SERVICE_ROLE_KEY` nunca vai para o client: só código de servidor a importa (com
  `import 'server-only'`).
- Supabase só muda via migration nova em `supabase/migrations/`, nunca por SQL avulso.
- Nunca invente depoimento, número, resultado ou preço: só o que a pessoa disser ou o que estiver
  no Instagram e no site dela (pasta `analise/`, que nunca vai para o git).

### Conferir chave (só contagem)

Cada contagem abaixo precisa dar 1 ou mais (0 = faltou):

- Token da Apify: `grep -c '^APIFY_TOKEN=[A-Za-z0-9_-]\{20,\}' .env.local`.
- Endereço do Supabase: `grep -cE '^SUPABASE_URL=https://[a-z0-9-]+\.supabase\.co' .env.local`.
- Chave secreta do Supabase: `grep -cE '^SUPABASE_SERVICE_ROLE_KEY=(sb_secret_|eyJ)' .env.local`.
  Se `grep -c '^SUPABASE_SERVICE_ROLE_KEY=sb_publishable_' .env.local` der 1, ela
  colou a chave pública: peça a Secret key (começa com `sb_secret_`).
- Chave antiga (`eyJ...`): a `anon` também começa assim. Confira o papel sem mostrar a chave:
  `node -e "const l=require('fs').readFileSync('.env.local','utf8').split(/\r?\n/).filter(x=>x.startsWith('SUPABASE_SERVICE_ROLE_KEY=')).pop()||'';const v=l.slice(26).trim().replace(/^[\"']|[\"']$/g,'');try{console.log(JSON.parse(Buffer.from(v.split('.')[1],'base64url')).role||'sem papel')}catch{console.log('nao e chave antiga')}"`.
  Precisa responder `service_role`. Respondeu `anon`: é a chave pública; peça a `service_role`.
- Deu 0 com a linha preenchida (`grep -c '^NOME=.' .env.local` não dá 0): sobrou espaço, aspas ou um
  pedaço faltando. Peça para colar de novo, logo depois do `=`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
