---
name: ligar-pagamento
description: Faz a agenda da bio cobrar por Pix antes de confirmar o horário (ex.: 30 minutos = R$ 300, 60 minutos = R$ 500). Quem marca escolhe o horário, ele fica separado por uns minutos e só vira compromisso na agenda quando o Pix cai. Use quando a pessoa pedir "cobrar pela consulta", "só marcar depois de pagar", "agenda paga", "Pix na agenda", "preço da sessão", ou quando a confirmação do Pix parar de funcionar. Precisa da agenda já ligada (skill ligar-agenda).
---

# Agenda paga por Pix

Antes: a agenda precisa estar ligada e funcionando (skill `ligar-agenda`) e a migration
`supabase/migrations/0013_agenda_paga.sql` rodada no banco (a `ligar-agenda` já pede).

Siga "Como falar com a pessoa" e "Segurança" do `AGENTS.md`: chave nunca no chat, um passo por mensagem
nos sites.

## 1. Preços e prazo

Pergunte, uma coisa por vez, e não invente valor:
1. "Quanto custa cada atendimento?" Para cada serviço do bloco `agendamento`, o preço vai em
   `price_cents` (em centavos: R$ 300 = 30000). Serviço sem preço (ou 0) continua grátis.
2. "Por quanto tempo o horário fica separado esperando o Pix?" Padrão 15 minutos (`pagamento.prazo`,
   de 5 a 60). Se ela não souber, use 15.

## 2. Como o Pix é confirmado

Explique as duas formas e deixe ela escolher (`pagamento.modo`):

- **Mercado Pago** (`"mercadopago"`, recomendado): cada reserva ganha um QR próprio e a confirmação é
  na hora. O Mercado Pago cobra uma taxa por Pix (confira no site dele). Precisa de conta Mercado Pago.
  Quem marca precisa informar e-mail (o Mercado Pago exige).
- **E-mail do banco** (`"email"`): o Pix cai direto na chave dela, sem taxa. Cada reserva recebe um
  valor com centavos próprios (R$ 300,17) e o site lê o aviso de "Pix recebido" que o banco manda por
  e-mail. Precisa: chave Pix, nome e cidade (`pagamento.chave`, `pagamento.nome`, `pagamento.cidade`,
  iguais ao bloco pix) e uma caixa de e-mail que receba esses avisos. **Não funciona com caixa
  Outlook/Microsoft 365** (a Microsoft não aceita senha de app); Gmail, Zoho, iCloud e Yahoo funcionam.
  A confirmação leva de segundos a alguns minutos, conforme o banco manda o e-mail.

## 3a. Mercado Pago

1. Em mercadopago.com.br/developers, "Suas integrações" > "Criar aplicação" (nome "Bio", produto
   Pagamentos online / Checkout Transparente). Em "Credenciais de produção", copie o **Access Token**
   (começa com `APP_USR-`).
2. Garanta as linhas e abra o editor como no `AGENTS.md`, para `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET`.
   Ela cola o Access Token em `MP_ACCESS_TOKEN=`.
3. Na mesma aplicação, "Webhooks" > "Configurar notificações": modo produção, URL
   `https://<endereço da bio>/api/agendamento/mercadopago`, evento **Pagamentos**. Salvar. Copie a
   **assinatura secreta** e cole em `MP_WEBHOOK_SECRET=`.
4. Confira por contagem: `grep -c '^MP_ACCESS_TOKEN=APP_USR-' .env.local` e
   `grep -c '^MP_WEBHOOK_SECRET=.' .env.local` precisam dar 1.

## 3b. E-mail do banco

1. Pergunte qual banco recebe o Pix e em qual e-mail chega o aviso de "Pix recebido". Peça para ela
   conferir que o aviso por e-mail está ligado no app do banco (alguns só mandam notificação no celular).
2. Senha de app da caixa (Gmail: myaccount.google.com > Segurança > Verificação em duas etapas >
   Senhas de app; precisa da verificação em duas etapas ligada). Explique: "é uma senha só para o site
   ler os avisos; não é a sua senha do Gmail e dá para apagar quando quiser".
3. Garanta as linhas `IMAP_HOST`, `IMAP_USER`, `IMAP_PASS`, `IMAP_REMETENTE` e abra o editor. Gmail:
   `IMAP_HOST=imap.gmail.com`. `IMAP_USER` = o e-mail, `IMAP_PASS` = a senha de app (sem espaços),
   `IMAP_REMETENTE` = o domínio do e-mail do banco (ex.: `nubank.com.br`; peça para ela olhar um aviso
   antigo).
4. Confira por contagem: `grep -c '^IMAP_HOST=.' .env.local`, `grep -c '^IMAP_USER=.' .env.local`,
   `grep -c '^IMAP_PASS=.' .env.local`.
5. **Pix que chega com a página fechada**: a confirmação roda quando alguém abre a bio ou a tela do Pix.
   Para garantir, ligue uma chamada a cada 10 minutos em cron-job.org (grátis) para
   `https://<endereço da bio>/api/agendamento/varrer` com o cabeçalho
   `Authorization: Bearer <CRON_SECRET>`. Sem `CRON_SECRET`, gere um (`openssl rand -base64 32`) e grave
   pela regra de chave. A cron da Vercel passa só uma vez por dia.

## 4. Config e teste

1. No bloco `agendamento`: `pagamento: { modo, prazo? , chave?, nome?, cidade? }` e `price_cents` nos
   serviços. `npm run check`.
2. Teste com um valor baixo (ex.: um serviço de teste a R$ 1,00) e avise antes: "vou marcar um horário
   de teste e você paga R$ 1 para conferir; depois apagamos o evento e você devolve o Pix se quiser".
   Só com o "sim". Confira: a tela mostra o QR, depois do Pix vira "Horário marcado" e o evento aparece
   na agenda.
3. No ar: as variáveis novas vão para a Vercel ("Variáveis" da skill `publicar`) e precisa de Redeploy.
   Sem elas, o bloco vira WhatsApp (nunca marca de graça um serviço com preço).

## Problemas

- **Pix pago e a tela não confirmou (modo e-mail)**: o valor pago tem que ser exatamente o da tela, com
  os centavos. Confira se o aviso do banco chegou na caixa e se `IMAP_REMETENTE` bate com o remetente.
- **Pix chegou depois do prazo**: se o horário ainda estava livre, confirma sozinho. Se outra pessoa
  pegou, a reserva fica "paga sem horário" e ela recebe um aviso (webhook/e-mail do lead) para combinar
  outro horário ou devolver o Pix.
- **Bloco virou WhatsApp depois de pôr preço**: falta variável do modo escolhido (no computador ou na
  Vercel) ou o Redeploy.
