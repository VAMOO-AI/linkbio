---
name: ligar-agenda
description: Liga o Google Agenda da pessoa ao bloco agendamento, para quem visita a bio marcar um horário livre e a reserva cair direto na agenda dela, com link do Meet. Use quando a pessoa pedir "quero que marquem horário pela bio", "ligar minha agenda", "conectar o Google Agenda", "agenda online", quando o bloco agendamento mostrar só o botão de WhatsApp, ou quando a agenda parar de mostrar horários ("desconectou").
---

# Ligar o Google Agenda

O bloco `agendamento` mostra os horários livres da agenda dela e cria o evento quando alguém marca.
Ele precisa de três coisas: o banco (Supabase), um "app" no Google Cloud dela (o Google exige isso
para dar acesso à agenda) e a conexão da conta. Leva uns 20 minutos, e o Google Cloud não cobra nada
por isso. Avise antes: "São uns 20 minutos no site do Google. Vou te guiar tela por tela."

Siga "Como falar com a pessoa" e "Segurança" do `AGENTS.md`: um passo por mensagem nos sites, e
chave nunca no chat.

## 1. Banco

Rode `grep -cE '^SUPABASE_URL=https://[a-z0-9-]+\.supabase\.co' .env.local`. Deu 0: ligue o banco
primeiro (skill `ligar-painel`, partes 1 a 3; o painel em si é opcional).

Com o banco ligado, crie as tabelas da agenda: no SQL Editor do Supabase, cole o arquivo
`supabase/migrations/0009_agendamentos.sql` (Mac: `pbcopy < supabase/migrations/0009_agendamentos.sql`;
Windows: `clip < supabase/migrations/0009_agendamentos.sql`), peça para ela clicar em Run e esperar
"Success". Pode rodar de novo sem problema. Banco que nunca recebeu nenhuma migration: rode todas em
ordem, como no `ligar-painel`.

## 2. App no Google Cloud

Em console.cloud.google.com, entrando com a conta Google **da agenda que vai receber os horários**.
Um passo por mensagem; o nome dos menus muda de vez em quando, então descreva o objetivo e peça um
print se ela não achar.

1. **Projeto novo**: no seletor de projetos (topo da tela), "Novo projeto", nome "Agenda da bio",
   Criar. Confira se ele ficou selecionado.
2. **Ligar a API**: no menu, "APIs e serviços" > "Biblioteca". Busque "Google Calendar API" e
   clique em Ativar.
3. **Tela de consentimento** ("Google Auth Platform" ou "Tela de consentimento OAuth"): Começar.
   Nome do app: "Agenda da bio". E-mail de suporte: o dela. Público: **Externo**. E-mail de contato:
   o dela. Aceite e crie.
4. **Permissões** ("Acesso a dados" ou "Escopos"): "Adicionar ou remover escopos". Marque as duas
   da Google Calendar API: `.../auth/calendar.events` e `.../auth/calendar.freebusy`. Salve.
5. **Publicar o app** (em "Público"): clique em "Publicar app" e confirme. Explique em uma frase:
   "Em modo Teste, o Google desliga a conexão sozinho depois de 7 dias; publicado, ela fica." Não
   precisa mandar para verificação: só ela vai usar o app.
6. **Cliente** ("Clientes" ou "Credenciais" > "Criar credenciais" > "ID do cliente OAuth"): tipo
   **App para computador** (Desktop app), nome "Bio". Criar. Vai aparecer o ID do cliente e a
   chave secreta do cliente: ela deixa essa janela aberta para o passo 3.

## 3. Chaves no computador

1. Garanta as linhas vazias, sem ler o arquivo:
   `grep -q '^GOOGLE_CLIENT_ID=' .env.local || printf '\nGOOGLE_CLIENT_ID=\n' >> .env.local` e
   `grep -q '^GOOGLE_CLIENT_SECRET=' .env.local || printf '\nGOOGLE_CLIENT_SECRET=\n' >> .env.local`.
2. Abra no editor (Mac `open -e .env.local`; Windows `start "" notepad .env.local`) e diga: "Abri um
   arquivo de texto. Na linha GOOGLE_CLIENT_ID=, cole o ID do cliente (termina em
   apps.googleusercontent.com). Na linha GOOGLE_CLIENT_SECRET=, cole a chave secreta do cliente
   (começa com GOCSPX-). Logo depois do `=`, sem espaço. Salve com Cmd+S ou Ctrl+S e me avise."
3. Confira só por contagem, sem mostrar valor. As duas precisam dar 1:
   `grep -cE '^GOOGLE_CLIENT_ID=[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com' .env.local` e
   `grep -c '^GOOGLE_CLIENT_SECRET=GOCSPX-' .env.local`. Deu 0: diga o que provavelmente faltou e
   abra o arquivo de novo.

## 4. Conectar a conta

Com o `.env.local` já fechado, rode `npm run google:conectar` com tempo limite de 10 minutos (no
Claude Code, timeout 600000) ou em segundo plano, e espere a linha `OK:` ou `NÃO CONECTOU:`. Com o
tempo limite padrão (2 minutos), o comando é encerrado no meio das telas do Google, e a volta da
autorização cai em "não é possível acessar esse site". Ele espera até 5 minutos e abre o
Google no navegador dela. Diga antes o que ela vai ver:

1. Escolher a conta da agenda.
2. "O Google não verificou este app": clicar em **Avançado** e depois em **Acessar Agenda da bio**.
   Explique: "O app é seu, criado agora há pouco; o aviso aparece porque ele não passou pela
   verificação do Google, que só é exigida para apps públicos."
3. Marcar **as duas** permissões da agenda e Continuar.
4. A aba diz "Agenda ligada". Pode fechar.

O comando termina com `OK: Google Agenda conectada (<e-mail>)`. O acesso fica guardado no banco; ninguém vê
o token. Se terminar com `NÃO CONECTOU`, leia o motivo e siga "Problemas".

## 5. Bloco e teste

1. Sem bloco `agendamento` na config, monte com ela pela skill `editar-bio` (serviços com nome e
   duração, dias, expediente e pausas). Não invente duração nem horário: pergunte.
2. `npm run check` e `npm run dev`. Ela abre a bio e confere os horários livres. Um compromisso que
   ela já tem na agenda não pode aparecer como livre.
3. Antes de testar uma reserva, diga que ela vai criar um evento de verdade na agenda dela (e
   apagar depois). Só com o "sim".
4. No ar: as chaves `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` (e as duas do Supabase, se ainda não
   estiverem lá) vão para a Vercel, como em "Variáveis" da skill `publicar`. Variável nova só vale
   depois de um deploy novo: em seguida, na Vercel, Deployments > o deploy mais recente > Redeploy
   (ou envie uma mudança pela skill `publicar`). Sem isso, a bio no ar continua no botão de WhatsApp.
   A conexão da conta já vale para o site no ar (fica no banco).
5. Confira no endereço público: o bloco mostra o calendário com dias livres, não o botão "Marcar pelo
   WhatsApp". Se mostrar o botão, falta variável ou deploy: volte ao passo 4.

## Problemas

- **A bio mostra "chame no WhatsApp" no lugar da agenda**: falta uma das quatro chaves (as duas do
  Supabase e as duas do Google), neste computador ou na Vercel, faltou o Redeploy depois de pôr as
  variáveis na Vercel, ou a conexão caiu. Confira por contagem, faça o Redeploy e, se ainda não
  aparecer, rode `npm run google:conectar` de novo.
- **Funcionou e parou depois de uns dias**: o app ficou em Teste (passo 2.5). Publique e conecte de
  novo. Trocar a senha do Google ou remover o acesso em myaccount.google.com/permissions também
  derruba: conecte de novo.
- **"redirect_uri_mismatch" ou "Erro 400"**: o cliente não é do tipo "App para computador". Crie
  outro desse tipo, troque as duas chaves no arquivo e conecte de novo.
- **"Acesso bloqueado: o app não concluiu a verificação" sem o link Avançado**: o app ficou em Teste
  e a conta dela não está na lista de testadores. Publique (passo 2.5).
- **"o Google não devolveu o refresh token"**: em myaccount.google.com/permissions, remova o acesso
  do "Agenda da bio" e conecte de novo.
- **"a tabela agenda_google não existe"**: rode o SQL do passo 1.
