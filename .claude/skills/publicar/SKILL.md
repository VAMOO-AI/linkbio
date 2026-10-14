---
name: publicar
description: Coloca a bio no ar pela primeira vez (GitHub, Vercel, variáveis, domínio próprio) ou envia para o site uma mudança feita no linkbio.config.ts ou no código. Use quando a pessoa pedir "coloca no ar", "quero o link para pôr no Instagram", "subir a bio", "publicar a mudança", "deploy" ou "usar meu domínio". Não use para o que foi editado no /admin: ali basta o botão Publicar do próprio painel.
---

# Publicar

Nada vai ao ar sem `npm run check` verde. A pessoa confirma antes de cada envio.

Palavras que ela vai ouvir (explique na primeira vez): **commit** = salvar uma versão; **push** =
enviar essa versão para o GitHub; **deploy** = a Vercel colocar a versão nova no ar.

## Antes

1. `npm run check`. Vermelho: corrija primeiro.
2. `git status`: `.env.local` não pode aparecer para commit (está no `.gitignore`; se aparecer,
   pare). `next-env.d.ts` modificado depois de um build é normal.

## Primeira vez

Avise: "vamos usar duas contas gratuitas, GitHub (guarda os arquivos da bio) e Vercel (deixa a
bio no ar). Leva uns 15 minutos." Pergunte se ela já tem cada uma; sem conta, mande o link de
cadastro (github.com/signup) e espere o "feito".

1. **Git local** (o zip não traz): sem `.git`, rode `git init -b main`, `git add -A` e
   `git commit -m "minha bio"`. Se pedir nome e e-mail: `git config user.name "..."` e
   `git config user.email "..."` com os dados dela.
2. **GitHub (você roda; ela só confirma no navegador):**
   - Sem o `gh` (o programa que fala com o GitHub), instale. Mac: `brew install gh` se houver
     Homebrew; sem ele, `bash scripts/instalar-gh.sh`, que baixa o instalador oficial, confere o
     checksum e só abre se bater. Respondeu `ABERTO`: ela clica em Continuar e digita a senha do
     Mac. Respondeu `DIFERENTE`, `SEM CHECKSUM` ou `FALHOU O DOWNLOAD`: nunca abra o arquivo por
     conta própria; rode de novo uma vez e, se repetir, avise em uma frase que o download não
     passou na conferência. Windows: `winget install --id GitHub.cli -e
     --accept-source-agreements --accept-package-agreements` (ela clica em Sim). Se o `gh` não
     responder depois, peça: "Feche o app do Claude por completo, abra de novo nesta mesma pasta
     e me escreva: continua."
   - `gh auth status`. Sem login, rode em segundo plano
     `gh auth login --hostname github.com --git-protocol https --web --clipboard </dev/null`.
     Ele mostra um código de 8 letras (`XXXX-XXXX`), copia esse código e mostra o endereço
     `https://github.com/login/device`. Abra o endereço para ela (Mac `open <url>`; Windows
     `start "" <url>`) e escreva o código na conversa (não é senha): "Abri o GitHub no navegador.
     Entre na sua conta e digite este código: XXXX-XXXX (ele também já está copiado, é só colar).
     Clique em Continue e depois em Authorize. Me avise quando aparecer que deu certo." O comando
     termina sozinho quando ela autoriza.
   - `gh` antigo, sem a opção `--clipboard` (ele reclama de "unknown flag"): rode sem ela e só
     escreva o código na conversa, sem dizer que já está copiado.
   - Se o comando terminar com erro, ou passar de uns 15 minutos sem ela autorizar (o código
     vence), encerre e rode de novo: o código muda, então mostre o novo.
   - Confira com `gh auth status` e rode `gh auth setup-git` (o `git push` passa a usar esse login).
   - Com o "sim" dela: `gh repo create <nome> --private --source . --push`,
     com `<nome>` = o nome escolhido no setup (o de `site.url`, antes de `.vercel.app`). Se já existir
     um repositório com esse nome na conta dela, use `<nome>-bio`. Não use o nome `linkbio-template`. A cada envio o GitHub roda os testes sozinho.
   - Se `config/distribuicao.ts` tiver `URL_DISTRIBUICAO` preenchido (um endereço, não vazio), rode
     `git remote add upstream <esse endereço>`. Se o remote `upstream` já existir, não troque. Se o
     campo estiver vazio, pule: a atualização por git ainda não está ligada.
3. **Vercel:** em vercel.com, entrar com a conta do GitHub, "Add New Project" e importar o
   repositório. Em **Project Name**, o mesmo `<nome>` (é ele que vira `<nome>.vercel.app`).
   Framework: Next.js, sem mudar o comando de build. Com o painel ligado, cole as
   variáveis do passo 4 em Environment Variables, nessa mesma tela, antes de clicar em Deploy.
4. **Variáveis** (Project Settings > Environment Variables): só com o painel ligado (skill
   `ligar-painel`), as três `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `ADMIN_SESSION_SECRET`.
   Os valores não passam pelo chat: rode `npm run admin:segredo` antes (se faltar o segredo),
   depois abra o `.env.local` no editor dela (Mac `open -e .env.local`; Windows
   `start "" notepad .env.local`). Ela copia cada valor de lá e cola na Vercel, e fecha o arquivo
   sem mudar nada (se o editor perguntar se quer salvar, "Não salvar"). Sem painel, nenhuma
   variável. `CRON_SECRET` é opcional (protege a visita diária ao banco); `APIFY_TOKEN` só serve no seu computador
   (setup); as outras do `.env.example` são de funções futuras: não configure.
5. Deploy e abrir o endereço que a Vercel der.
6. Se o endereço que a Vercel deu for diferente de `site.url` (nome já usado por outra pessoa: ela
   acrescenta um final, ex.: `ana-nutri-abc123.vercel.app`), ofereça: (a) ficar com esse, ou (b)
   trocar por outro nome livre: Project > Settings > Domains, no endereço `.vercel.app`, "Edit",
   digitar o nome novo e salvar (se estiver ocupado, a Vercel avisa na hora). Depois, `site.url` = o endereço que ficou (com painel já publicado:
   `/admin` > Contato e site), check e envie de novo ("Mudanças depois").
7. Domínio próprio anotado no setup: siga para "Domínio próprio" agora.

## Domínio próprio

1. Pergunte onde o domínio foi comprado (Registro.br, GoDaddy, Hostinger...).
2. Na Vercel: Project > Settings > Domains, adicione o domínio. Ela mostra um registro de DNS (o
   aviso que liga o domínio à Vercel).
3. Mostre esses valores e diga: "entre no site onde comprou, procure DNS ou Zona e crie este
   registro". Pode levar algumas horas para valer.
4. Depois, `site.url` passa a ser o domínio.

## Mudanças depois

- Conteúdo pelo painel: basta **Publicar** no `/admin`. Não precisa desta skill.
- Mudança no `linkbio.config.ts` ou no código: `npm run check`, commit e, com o "sim" dela,
  `git push`. A Vercel publica sozinha em 1 ou 2 minutos.
- Variável nova ou alterada na Vercel só vale depois de um novo deploy (Deployments > Redeploy).

## Conferir no ar

No celular: foto, botão do WhatsApp (abre com a mensagem certa), concierge até o fim, links. Com
painel, entrar em `/admin/login`. Ofereça em seguida trocar o link da bio no Instagram.
