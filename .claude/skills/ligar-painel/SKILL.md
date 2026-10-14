---
name: ligar-painel
description: Liga o painel /admin para editar a bio pelo navegador ou celular, sem mexer em arquivo (banco Supabase, segredo de sessão e e-mail de quem entra). O acesso normal é um código de 6 dígitos nesse e-mail. Use quando a pessoa pedir "quero editar pelo celular", "editar pelo navegador", "ligar o painel", "ligar o admin", "criar meu login", "esqueci a senha do painel", ou quando /admin mostrar "O painel ainda não está ligado".
---

# Ligar o painel /admin

Sem painel, a bio funciona pelo `linkbio.config.ts`. Com ele, a pessoa edita em `https://<site>/admin`.
São três peças: banco (Supabase), segredo de sessão e o e-mail de quem entra. O código chega nesse
e-mail. Leva uns 15 minutos.

Quem já tem senha continua entrando com ela. Senha nova só no plano B, no fim, se ela pedir.

Para usar no celular, a bio precisa estar no ar. Se ainda não está, combine a ordem: ligar aqui,
testar neste computador e depois `publicar` (que leva as variáveis para a Vercel).

## 1. Banco

1. O caminho curto é a integração da Vercel (passo 2). Se ela preferir criar o projeto em
   supabase.com: nome da bio, região South America (São Paulo). A senha do banco que ele pede vai
   para um gerenciador de senhas, não para o chat.
2. Crie as tabelas rodando as migrations, em ordem, sem escrever SQL à mão. No projeto, abra o
   SQL Editor; para cada arquivo de `supabase/migrations/` em ordem de nome (do `0001_...` até o
   último, incluindo o de login por código), copie o conteúdo (Mac: `pbcopy < supabase/migrations/<arquivo>`;
   Windows: `clip < supabase/migrations/<arquivo>`, com barra normal), peça para ela colar e clicar em Run, e espere
   "Success" antes do próximo.
   Não use o caminho pela CLI do Supabase (`npx supabase login`) com quem não usa terminal: o login
   é interativo (pode pedir um token), e token não passa pelo chat.
3. Se o projeto não veio da integração: em Project Settings, na tela de chaves de API (o nome do
   menu muda), ficam a URL do projeto e a chave secreta. Serve a chave "secret" (começa com
   `sb_secret_`) ou, na aba das chaves antigas (Legacy), a `service_role` (começa com `eyJ`). Nunca
   a "publishable" ou `anon`.

## 2. Supabase pela integração da Vercel

Menos passos quando a bio vai para a Vercel. A integração grava as variáveis sozinha; a pessoa não
cria conta no supabase.com.

Fonte dos nomes (doc oficial, integração Marketplace): `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_JWT_SECRET`, e as `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`,
`POSTGRES_USER`, `POSTGRES_HOST`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`. Não existe
`SUPABASE_SERVICE_ROLE_KEY` nessa lista. O painel aceita `SUPABASE_SECRET_KEY` no lugar dela, e
`NEXT_PUBLIC_SUPABASE_URL` se `SUPABASE_URL` faltar. Não peça nem copie `POSTGRES_PASSWORD`.

1. Na Vercel, no projeto da bio: Marketplace (ou Integrations) → Supabase → instalar e criar o
   projeto. Região South America (São Paulo), se perguntar. Espere ela dizer que conectou.
2. As variáveis já estão na Vercel. Neste computador ainda falta o arquivo local, para testar o
   login aqui: garanta as linhas (sem ler o arquivo) e abra no editor, como no passo 3. Ela cola
   o endereço em `SUPABASE_URL=` e a chave secreta em `SUPABASE_SECRET_KEY=` (a que a integração
   mostra; começa com `sb_secret_`).
3. As tabelas não nascem com a integração. Rode as migrations no SQL Editor, como no passo 1.
4. O segredo de sessão não vem da integração. Siga o passo 3 para o `ADMIN_SESSION_SECRET`.

## 3. Variáveis neste computador

Nada de chave no chat. A ordem importa: o que você grava por comando vem antes de abrir o arquivo
no editor (ao salvar, o editor sobrescreveria o que você gravou com ele aberto).

1. Garanta o arquivo e grave o segredo de sessão sem mostrar o valor:
   `test -f .env.local || cp .env.example .env.local` e depois `npm run admin:segredo`.
2. Garanta as linhas vazias, sem ler o arquivo ("Segurança" do `AGENTS.md`, passo 1):
   `grep -q '^SUPABASE_URL=' .env.local || printf '\nSUPABASE_URL=\n' >> .env.local`,
   `grep -q '^SUPABASE_SECRET_KEY=' .env.local || printf '\nSUPABASE_SECRET_KEY=\n' >> .env.local`,
   `grep -q '^SUPABASE_SERVICE_ROLE_KEY=' .env.local || printf '\nSUPABASE_SERVICE_ROLE_KEY=\n' >> .env.local` e
   `grep -q '^RESEND_API_KEY=' .env.local || printf '\nRESEND_API_KEY=\n' >> .env.local`.
   Quem veio da integração preenche `SUPABASE_SECRET_KEY`. Quem criou o projeto no supabase.com
   preenche `SUPABASE_SERVICE_ROLE_KEY`. Uma das duas basta.
3. Abra no editor (Mac `open -e .env.local`; Windows `start "" notepad .env.local`) e diga: "Abri
   um arquivo de texto. Na linha SUPABASE_URL=, cole a URL do projeto. Na linha da chave secreta
   (SUPABASE_SECRET_KEY= ou SUPABASE_SERVICE_ROLE_KEY=), cole a chave que começa com sb_secret_.
   Na linha RESEND_API_KEY=, cole a chave da Resend (passo 4). Sempre logo depois do `=`, sem
   espaço. Salve com Cmd+S (Mac) ou Ctrl+S (Windows) antes de fechar e me avise." (O Bloco de
   Notas guarda cópia do que não foi salvo e fecha sem perguntar: sem Ctrl+S, a chave não entra.)
4. Confira só por contagem ("Conferir chave" do `AGENTS.md`). Para a chave da integração:
   `grep -cE '^SUPABASE_SECRET_KEY=(sb_secret_|eyJ)' .env.local` precisa dar 1. Para a Resend:
   `grep -c '^RESEND_API_KEY=re_[A-Za-z0-9_-]\{8,\}' .env.local` precisa dar 1. Chave pública no
   lugar da secreta: peça a Secret key e abra o arquivo de novo. Nunca mostre os valores.

`ADMIN_SESSION_SECRET` e o endereço vão depois para a Vercel (skill `publicar`), se ainda não
estiverem lá pela integração. A Resend também.

## 4. E-mail de quem entra, e o envio do código

O código só chega se a Resend estiver ligada, com a conta no mesmo e-mail do painel. O remetente
grátis (`onboarding@resend.dev`) não entrega em outro endereço e não pede domínio.

1. Peça para ela criar a conta em resend.com com o e-mail que vai usar para entrar no painel.
   Em API Keys, criar uma chave. Não cole a chave no chat: ela entra no arquivo, no passo 3.
2. Pergunte o e-mail (o mesmo da conta Resend) e cadastre, sem senha:
   `npm run admin:usuario -- email@da-pessoa.com`
   A saída é uma linha `OK:` e não tem senha. O comando pede permissão porque também sabe criar senha.
3. Deu erro falando da migration: o banco ainda não tem a tabela do código. Volte ao SQL Editor,
   rode o arquivo novo de `supabase/migrations/` e repita o comando.

## 5. Conferir

1. A prova é o login: `npm run dev` em segundo plano (se já estava rodando, encerre e rode de novo)
   e a pessoa abre `/admin/login` no endereço que ele mostrar. Se aparecer "O painel ainda não está ligado. Falta configurar: ...", complete o que
   ele listar.
2. Ela digita o e-mail, toca em **Receber código no e-mail**, e digita os 6 números que chegarem.
   O código vale 10 minutos e só serve uma vez. 5 erros seguidos esperam 15 minutos, no e-mail
   cadastrado ou não: a tela não diz se aquele e-mail pode entrar.
3. Explique: cada edição vira rascunho automático; nada vai ao ar sem **Publicar**; cada publicação
   vira uma versão; em Versões dá para voltar a qualquer uma, inclusive ao **Arquivo original**.
4. Avise: depois da primeira publicação pelo painel, a bio passa a ler do banco e editar o
   `linkbio.config.ts` deixa de mudar o site.
5. Com a bio no ar, ela mesma mantém o banco ativo (uma visita automática por dia), então o
   Supabase gratuito não pausa por falta de uso.

Próximo passo para oferecer: `publicar` (se ainda não está no ar ou falta levar as variáveis).

## Plano B: senha em arquivo

Só se ela pedir uma senha, ou se o código não chegar. Quem já tem senha entra por "Se você já tem senha"
sem este passo.

A senha não passa pela conversa e você não lê a senha. Você roda o comando com a saída indo para
um arquivo dentro de `analise/` (pasta que nunca vai para o git), e ela lê a senha no editor:

1. Rode:
   `mkdir -p analise && npm run --silent admin:usuario -- email@da-pessoa.com --senha > analise/senha-do-painel.txt 2> analise/painel-erro.txt; echo "saida=$?"`
2. Confira sem mostrar a senha: `grep -c '^OK:' analise/senha-do-painel.txt` precisa dar 1.
   Deu 0 ou `saida` diferente de 0: leia só `analise/painel-erro.txt` (não tem senha), traduza o
   erro e, na mesma etapa, apague os dois arquivos:
   `rm -f analise/senha-do-painel.txt analise/painel-erro.txt`. Corrija e volte ao item 1.
3. Deu certo: apague logo o arquivo de erro (`rm -f analise/painel-erro.txt`) e abra a senha no
   editor (Mac `open -e analise/senha-do-painel.txt`; Windows
   `start "" notepad analise/senha-do-painel.txt`) e diga: "Abri um arquivo com a sua senha do painel.
   Guarde num gerenciador de senhas (ou anote num lugar seguro), feche o arquivo e me avise. Ela
   não aparece de novo."
4. Depois do "guardei": `rm -f analise/senha-do-painel.txt`. Nunca leia esse arquivo.
