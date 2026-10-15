# Changelog

## Não lançado

### Para quem usa
- Nada novo desde a v0.6.4.

## v0.6.4 (2026-10-15)

### Para quem usa
- Ao publicar, eu levo para a Vercel as chaves que a sua bio usa: a da IA do concierge e a do e-mail, quando estiverem ligadas.
- Os testes automáticos do GitHub deixam de dar "falhou" quando a bio tem formulário de contato ou concierge com IA.

### Na bio e no painel
- No CI (`CI=true`), faltar `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` ou `ANTHROPIC_API_KEY` vira aviso no `npm run check`: essas chaves moram na Vercel, não no GitHub. No computador continua erro.
- Skill `publicar`: a lista de variáveis sai da config (painel, bloco lead, concierge IA, e-mail, webhook, pixel). Antes ela mandava não configurar `ANTHROPIC_API_KEY` nem `RESEND_API_KEY`.

## v0.6.3 (2026-10-13)

### Para quem usa
- Uma vez por dia, a bio avisa qual versão do template está no ar.

### Na bio e no painel
- O ping diário vai para o hub. Para desligar, `LINKBIO_PING_URL=off`. Outro endereço, se preenchido, substitui o hub.

## v0.6.2 (2026-10-13)

### Para quem usa
- O check avisa sozinho quando sai uma versão nova do template.
- A bio também liga com a chave nova do Supabase, a que a Vercel grava sozinha.
- Com a contagem de cliques ligada, o pixel continua marcando o toque no WhatsApp.

### Na bio e no painel
- O aviso de versão lê o `versao.json` do repositório de distribuição. Se esse endereço não responder, vale a tag do remote `upstream`. `LINKBIO_VERSAO_URL` continua ganhando, se estiver preenchida.
- Keepalive, saúde, capa e a página passam a aceitar `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SECRET_KEY`, os nomes da integração da Vercel.
- O atalho `/r/` de um botão de WhatsApp leva `?wa=1`. O aviso de cookies usa isso para disparar o evento, porque o href que a pessoa clica já não é o `wa.me`.
- `POST /api/frota` guarda o ping diário (site, versão, origem da config) quando `FROTA_RECEPCAO=1`. Nas bios o ping continua desligado até `LINKBIO_PING_URL` apontar para esse hub.

## v0.6.1 (2026-10-13)

### Para quem usa
- A bio já sabe de onde puxar a próxima versão.

## v0.6.0 (2026-10-13)

### Para quem usa
- Você pede a bio pelo app do Claude, na pasta dela. Eu faço o resto e digo só onde clicar.
- Chave e senha ficam no seu computador: você cola no arquivo e eu só confiro se entrou, sem aparecer na conversa.
- Nesta versão: formulário de contato, Pix, agenda, bloco com data de início e fim, cliques no painel, pixel com aviso de cookies, login do painel por código no e-mail e concierge com dúvida livre.

### Na bio e no painel
- Formulário de contato (nome + WhatsApp ou e-mail). Os envios aparecem no painel, em Contatos, e dá para baixar a planilha.
- Pix com QR e código para copiar, gerado no servidor. Agenda com os próximos encontros, botão do Google Agenda e arquivo para o calendário do celular.
- Qualquer bloco pode aparecer só entre duas datas (turma que ainda não abriu, aviso que já venceu). Fora do prazo ele some da bio e fica guardado.
- Contagem de cliques no painel, na aba Resultados (7 e 30 dias, por botão e por origem), sem cookie. Pixel da Meta e Google Analytics só depois do aviso de cookies.
- Entrar no painel com código de 6 dígitos no e-mail. Quem já tem senha continua usando a senha.
- O concierge pode responder uma dúvida livre (além das perguntas prontas). Sem a chave, valem só as perguntas.
- O check avisa se saiu versão nova do template. A visita diária do banco pode mandar um ping (endereço, versão, se a bio veio do arquivo ou do banco), sem o conteúdo da bio.

### Menos "Permitir"
- `.claude/settings.json` abre em aceitar edições e libera os comandos de rotina das skills (check, dev, analisar, foto, instaladores conferidos, as contagens exatas que as skills fazem no `.env.local`, abrir arquivo no editor). Curinga só onde não dá para ler nem apagar segredo; `git diff`/`git log` só na forma exata, com `--no-index` e `--output` bloqueados. Continuam perguntando: apagar, `cp` por cima do `.env.local`, `npm run chave`, `npm run admin:usuario`, `node -e` e leitura de arquivo de chave. O Claude não lê `.env.local` nem `analise/senha-do-painel.txt` (deny). `tests/settings.test.ts` trava essas regras com lista fechada de curingas. `npm run foto` passa a recusar endereço que não seja `http(s)` (`file://` fotografava arquivo local) e só a forma sem argumento é liberada.

### Pelo app do Claude, sem terminal
- Entrada nova: app do Claude, aba Code, pasta `linkbio/` e a mensagem "Monta a minha bio. Eu não uso terminal: faça tudo por mim e me diga só onde clicar." (`COMECE-AQUI.html` novo e "Começo rápido" do README). Nenhuma doc ou skill manda mais rodar `claude` no terminal.
- Setup: sem Node, o Claude baixa e abre o instalador (Mac `.pkg`, Windows `winget` ou `.msi`) e a pessoa só clica. Se precisar reiniciar, é fechar e abrir o app do Claude na mesma pasta e escrever "continua".
- Publicar: o login do GitHub roda pelo Claude (`gh auth login --web` sem terminal da pessoa, código confirmado no navegador, depois `gh auth setup-git`); o `gh` é instalado por `.pkg`/`winget`. As variáveis da Vercel são copiadas do `.env.local` aberto no editor dela.
- Painel: a senha do `/admin` sai num arquivo em `analise/` aberto no editor e apagado depois, em vez de "outra janela do terminal". Sai o caminho pela CLI do Supabase para quem não usa terminal.

### Chave nunca no chat (reverte "Chaves no chat" da v0.5.1)
- Token da Apify, endereço e chave secreta do Supabase: o Claude garante a linha vazia no `.env.local`, abre o arquivo no editor de texto (`open -e` no Mac, `notepad` no Windows), a pessoa cola e salva, e o Claude confere só por contagem (`grep -c`), sem mostrar valor. A chave pública no lugar da secreta continua sendo apontada.
- Nada é gravado no `.env.local` por comando enquanto ele está aberto no editor (o editor sobrescreveria ao salvar).
- `npm run chave` fica só como plano B, se a pessoa colar a chave no chat mesmo assim (e o Claude recomenda gerar outra).
- Windows: o editor abre com `start "" notepad`, e a fala manda salvar com Ctrl+S antes de fechar (o Bloco de Notas guarda cópia do que não foi salvo e fecha sem perguntar).
- Chave antiga do Supabase (`eyJ...`): o Claude confere o papel (`service_role` x `anon`) decodificando só esse campo, sem mostrar a chave.
- Senha do painel: o Claude nunca lê `analise/senha-do-painel.txt`; se o arquivo sobrar de outra sessão, pergunta se ela já guardou e apaga. O arquivo de erro é apagado na mesma etapa.
- Pasta sugerida: a pasta pessoal (`~/linkbio` no Mac, `C:\Users\<nome>\linkbio` no Windows), não Documentos; o setup avisa se a pasta estiver no OneDrive ou no iCloud.
- Instaladores conferidos antes de abrir, num comando só: `scripts/instalar-node.sh` (Node `.pkg`/`.msi` contra o `SHASUMS256.txt`) e `scripts/instalar-gh.sh` (`gh` `.pkg` contra o `checksums.txt` da release). Só abrem com o hash esperado presente e igual ao obtido; senão apagam e respondem `DIFERENTE` ou `SEM CHECKSUM` (sem versão ou sem a linha do instalador, nada é baixado). Testes em `tests/instaladores.test.ts` com servidor falso. No Windows, o setup confere o Git primeiro (o Claude roda pelo Git Bash): `winget` ou o instalador de git-scm.com por clique.
- Aviso de pasta cobre também Downloads e Documentos/Mesa (no Mac, "Mesa e Documentos no iCloud" não aparece no caminho).
- `publicar`: `gh auth login --web --clipboard`, código escrito na conversa e novo código se o login falhar ou passar de uns 15 minutos.
- Teste novo `tests/superficie.test.ts`: reprova README, AGENTS, `COMECE-AQUI.html` ou skill que mande abrir terminal, PowerShell ou colar chave no chat (mesmo com a frase quebrada em duas linhas) ou que mande ler `.env.local` ou a senha do painel (`cat`, `sed`, `awk`, `source`, `grep` sem `-c`/`-q`, inclusive com `-A3`...), e confere que README e `COMECE-AQUI.html` trazem a mesma mensagem de entrada.

## v0.5.1 (2026-10-02)

Correções do teste do Nicolas como mentorado.

### Concierge e prévia
- Prévia do painel: link para fora (botão final do concierge, WhatsApp, oferta) abre em aba nova. Antes o clique não fazia nada, e parecia que o concierge "não finalizava".
- O concierge nunca termina vazio: resposta com oferta que não existe mais (ou sem destino no modo "ultima") vira o convite para conversar no WhatsApp.

### Modelos compatíveis com qualquer modo
- Modo ou paleta que o modelo não tem (sobra de troca de modelo, ex.: paleta escura no Editorial) não trava mais o Publicar: o motor ignora (`modoAceito` em `lib/resolver.ts`), o check só avisa e o painel limpa sozinho ao trocar de modelo (`acompanharModelo`).

### Chaves no chat
- `npm run chave -- <NOME> <valor>`: o token da Apify e o endereço e a chave secreta do Supabase podem ser colados no chat; o comando grava no `.env.local` sem repetir o valor (mostra só o fim) e recusa a chave pública no lugar da secreta. Senhas e tokens do GitHub/Vercel continuam fora do chat.

### Identidade visual
- Catálogo de fontes de 4 para 18 (Inter, Manrope, Montserrat, Poppins, DM Sans, Outfit, Sora, Albert Sans, Archivo, Lora; só títulos: Playfair, Fraunces, Syne, Mono). A capa de compartilhar usa a mais parecida das 4 originais (o zip não cresce).
- Novas opções de tema (motor + painel): `titulo` (fino, normal, forte), `accent2` (2ª cor da marca nos botões vazados), `palette.*.ctaBg2` (botão principal em degradê), `rotulos: "mono"` (selos e etiquetas técnicos, maiúsculos) e `fundoImagem` (imagem de fundo sob véu legível). O contraste confere também a 2ª cor do degradê.
- Coleta: fotografa o site (computador e celular), baixa imagens dos últimos posts, lê o botão em degradê e ignora cores translúcidas; `npm run foto` fotografa a prévia. O roteiro "Visual" foi reescrito: olhar as fotos, paleta completa, fonte exata, peso, rótulos, imagens com OK e conferir com os olhos.
- Teste frio de identidade (perfil e site reais): nota 6,5/10 com o roteiro novo e, com as opções novas do motor, a bio passa a ter título fino, degradê, 2ª cor e rótulos mono como o site.

## v0.5.0 (2026-10-02)

### Onboarding inteligente
- O setup virou o primeiro contato: ao abrir o Claude na pasta com a bio ainda no exemplo, qualquer mensagem (até "oi") começa o setup (hook `SessionStart` em `.claude/settings.json` + regra no `AGENTS.md`). A instalação roda em segundo plano enquanto a conversa segue.
- São 5 perguntas (nome, @, site, WhatsApp e o nome do endereço grátis `nome.vercel.app`, que vai para `site.url`, para o projeto na Vercel e para o repositório no GitHub; domínio próprio entra depois de publicar; o check valida o nome), "fiel ao site ou upgrade?" (só com site) e uma confirmação do que foi entendido, numa mensagem só (inclui, quando houver, posts em parceria, outra conta nos links e serviço sem página).
- `npm run analisar -- --instagram @perfil [--site url] [--bio-atual url] [--navegador]` grava em `analise/` (fora do git e do zip): perfil e 15 últimos posts (só os da própria pessoa contam para a voz; sem comentários nem marcações de terceiros), foto do perfil, links da bio atual (Linktree pelo JSON da página; Beacons e afins pelos links) e o site (cores em hex de hex/rgb/hsl/oklch por uso, variáveis de cor da marca sem a paleta padrão do Tailwind, fontes, Google Fonts, logo, ícone, títulos e textos). Site que só monta no navegador é lido com o Chromium do Playwright, quando instalado.
- Acesso ao Instagram pelo token da própria conta Apify (`APIFY_TOKEN`, no `.env.local`; cerca de US$ 0,03 por leitura). Sem token, modo manual (a pessoa cola 3 a 5 legendas). Falha em uma parte não para as outras.
- `setup-linkbio/referencias/analise.md`: como tirar a voz (tom, tratamento, palavras, emoji, chamada, ofertas, frases reais) e o visual (fundo, destaque, fonte do catálogo, cantos; versão fiel e versão upgrade), importar links e criar o token da Apify passo a passo.
- Gate do zip barra token da Apify (`apify_api_` em qualquer arquivo e `APIFY_TOKEN=` com valor) e a pasta `analise/`.
- Auditoria (01/10): cada fonte apaga os próprios arquivos antes de coletar (dado de uma rodada errada não sobra); link sem `https://` funciona; Instagram e site em paralelo; posts fixados de fora (`skipPinnedPosts`); perfil vale mesmo se os posts falharem; outro @ no resultado nunca vira o da pessoa; site com anti-robô (403) e bio que só monta no navegador (Beacons) caem no Chromium; bio sem links não grava arquivo vazio; fundo e botão principal lidos do elemento certo e em hex; logo e capa do site baixados (SVG vira PNG); cores do shadcn (HSL solto, `var()`), paleta do WordPress filtrada, seletor de id não conta como cor, `none` não vira `#NaN`; Roboto/Arial/Helvetica e next/font reconhecidas; erros técnicos em português; hook também após `/clear`; regras novas na referência (fiel com `palette`, `mode` do neutro, logo, http, redes fora da lista, token com `open -e`/`notepad`, CRLF do Windows).
- Sem site: o destaque vem das cores marcantes da foto do perfil (`coresDaFoto` em `instagram.json`, sem branco, preto e cinza, tons parecidos juntos); bio e nome com letras estilizadas de teclado de fonte voltam ao normal (NFKC).
- 2º teste frio (loja sem site, com Linktree): confirmação traz o visual e o WhatsApp para conferir; oferta só para algo concreto com destino; legenda que cita algo fora da coleta vira pergunta, nunca link inventado; Linklist, Linkr e Flowcode como bio de links; short.gy e rebrand como encurtador.
- Testes: `tests/onboarding.test.ts` (27 casos, sem rede) e 1 caso novo no `tests/zip-gate.test.ts`.

## v0.4.1 (2026-10-01)

### Auditoria
- Auditoria do painel com a bio publicada de verdade (de um cliente) no banco falso, em 1280 e 375 px, claro e escuro: as 7 seções, os 6 blocos dela, os 16 tipos novos, publicar título e texto do link, esvaziar e voltar ao padrão.
- Capa ao compartilhar depois de publicar: confere. A página pública e a `/capa.jpg` são refeitas na hora (`revalidateTag`): `og:title`, `og:description`, `twitter:*` e o `?v=` da imagem mudam no mesmo instante, e esvaziar título e texto volta ao nome com @ e à bio. A produção também mostra os textos publicados. Se o WhatsApp ainda mostra o texto antigo, é o cache dele, que guarda o cartão por endereço: o `?v=` renova só a imagem.
- Cantos: na bio com o raio em px antigo (`theme.radius`, em Avançado; o template e bios antigas têm 6), escolher Retos, Médios, Redondos ou Padrão não mudava os cards, porque o raio em px passava por cima. Agora escolher Cantos tira o raio em px; mexer só no raio continua valendo (`acompanharCantos` em `lib/admin/referencias.ts`).
- Título e texto do link (Contato e site > Capa ao compartilhar) eram campos de uma linha e o texto aparecia cortado (um texto real de 104 letras). Viraram caixas que crescem com o texto; Enter vira espaço, porque o cartão do link é uma linha corrida; um contador mostra quanto cabe (70 e 200 caracteres).
- Avisos com nome técnico saem em português: "o bloco gallery precisa de ao menos 1 imagem" virou "Adicione ao menos 1 imagem."; idem links, perguntas frequentes, depoimentos, redes (mínimo e máximo), perguntas e respostas do concierge, destino do botão e o filtro da vitrine. A lista de problemas chama a rede pelo nome ("Instagram") em vez de "item 1".
- Vitrine sem produto diz "Nenhum produto ainda: crie um aqui. Depois, ele aparece na bio pelo bloco Vitrine.", como Ofertas já dizia.
- Banco falso dos testes (`e2e/painel-servidor.ts`) ordenava o id como texto: a partir da 10ª publicação, a versão 9 passava por "a publicada" e a bio parecia parada. Agora compara número como número, como o Postgres. Com isso, 11 publicações seguidas, com a `/capa.jpg` lida no meio, atualizaram página e capa todas as vezes.
- Testes: `acompanharCantos` em `tests/admin-referencias.test.ts`; 15 mensagens em `tests/admin-mensagens.test.ts` (o exemplo de "mensagem que não reconhece" passou a ser outro, porque a dele agora é traduzida); 4 casos "auditoria:" no `e2e/painel.spec.ts`. Todos falham sem as correções.

### Capa ao compartilhar
- A prévia "Assim aparece no WhatsApp" é pedida pela rota `/admin/capa-previa` (com sessão), não por server action: o Next despacha as actions uma de cada vez, e desenhar a capa segurava o salvamento do rascunho ("Salvando rascunho..." parado com imagem grande ou rede lenta). O pedido velho é cancelado quando a pessoa continua digitando.
- Capa própria de outro formato não perde mais conteúdo. Antes toda imagem era recortada em 1200 x 630 (recorte "attention" do sharp): o banner 2940 x 1010 (2,9:1) de um cliente perdeu a lateral direita, com a frase e o "UMA EMPRESA. DOIS CAMINHOS". Agora: proporção até 10% longe da 1,91:1 (de ~1,71:1 a ~2,10:1, inclui 16:9) é recortada no centro, só na borda; mais larga, quadrada ou vertical entra inteira sobre as cores da própria imagem, bem desfocadas e escurecidas. A foto de celular girada (EXIF) é medida em pé. Continua JPG 1200 x 630 abaixo de 300 KB (banner do cliente: 52 KB). Regra em `encaixeDaCapa` (`lib/compartilhar.ts`); desenho em `capaDeImagem` (`lib/capa.tsx`).
- Painel, Contato e site > Capa ao compartilhar: "Assim aparece no WhatsApp", um cartão como o do WhatsApp (capa 1,91:1, título, texto e domínio) com o que está no rascunho. Título e texto mudam na hora; a imagem é gerada pelo mesmo código do `/capa.jpg` (inclusive a capa automática, sem imagem própria) 700 ms depois da última mudança, só para quem entrou no painel e só com imagem de `public/` ou do Storage. Avisa quando a imagem vai entrar inteira com fundo ("Sua imagem (2940 x 1010) é mais larga que o formato do WhatsApp... use 1200 x 630") e quando a imagem não abriu.
- Cache do WhatsApp explicado no painel: ele guarda a prévia de cada link e repete a antiga por um tempo. Botão "Copiar link com prévia nova" copia o link da bio com `?v=` da capa no ar (o mesmo da `og:image`; a página ignora o `?v`), aviso de "publique antes" quando a capa do rascunho ainda não está no ar, e link para o Depurador de Compartilhamento do Facebook ("Extrair novamente") para Facebook e Instagram. O `og:url` continua sem `?v` (endereço canônico; ver o motivo no PR).
- Dica da imagem: "Ideal 1200 x 630 (deitada)... Outro formato entra inteiro, com fundo."
- Testes: `tests/compartilhar.test.ts` (recortar x encaixar nas bordas da faixa, textos e link do cartão), `tests/capa.test.ts` (banner 2,9:1, quadrada, vertical 9:16, 1200 x 630 exata e foto girada: faixas coloridas nas quatro bordas continuam na capa; falhavam com o recorte antigo); `e2e/capa-publicada.spec.ts` (cartão com capa automática, título e texto ao vivo, aviso de formato, link copiado igual ao `?v` da `og:image`, publicar e conferir na hora meta tags e `/capa.jpg` com a imagem inteira; falhava antes).

### Concierge
- Quem decide o final agora é escolha (`decide` no bloco): `"primeira"` (padrão, o de sempre: a 1ª pergunta decide, as outras vão como contexto) ou `"ultima"` (vale a última resposta com `offer` ou `reason`; sem nenhuma depois da 1ª, vale a 1ª, que continua exigindo `reason`). No modo `"ultima"`, resposta de outra pergunta com `offer` precisa de `reason`; sem os dois, ela só vai como contexto. Bio sem `decide` não muda.
- Painel: "Quem decide o final: Só a 1ª pergunta / A última resposta com destino" no editor do concierge, com uma linha de explicação e exemplo. No modo "ultima", "Leva para" (com "Não muda o final (só contexto)") e "Explicação no final" aparecem em todas as perguntas; no modo "primeira", destino guardado numa pergunta de contexto aparece como "Destino ignorado", com botão para limpar, em vez de ficar escondido. Oferta apagada continua nas perguntas que podem decidir (o painel pede outra).
- Mensagem do WhatsApp: as respostas vão na 1ª linha, "(Vim pelo concierge: ...)", e o texto da oferta depois de uma linha em branco. Antes o contexto era colado no fim do texto, no meio de modelos que terminam em campos para preencher ("O principal gargalo ou impacto: (Vim pelo concierge: ...)").
- iPhone: ao chegar ao resultado, o conteúdo do bloco podia deslizar uns 16 px para a esquerda (o foco no resultado rolava a área escondida do brilho do canto). O bloco usa `overflow: clip`, que corta sem virar área de rolagem; o visual não muda.
- Testes: `tests/concierge.test.ts` (os 2 modos com o concierge de uma bio real, o texto da mensagem e o schema), casos novos em `tests/check.test.ts`, `tests/admin-referencias.test.ts` e `tests/admin-mensagens.test.ts`; `e2e/concierge.spec.ts` (modo padrão, ordem da mensagem e o deslize no iPhone 14 em WebKit) e `e2e/painel.spec.ts` (trocar o modo, "Leva para" em todas as perguntas, prévia seguindo a última resposta, limpar destino ignorado).

## v0.4.0 (2026-09-30)

### Capa ao compartilhar
- Capa automática nova (a imagem do link no WhatsApp, Instagram e Telegram): foto redonda, nome, @ e bio no visual do modelo (cores do modo que a página mostra primeiro, cor de destaque, fonte do título e fundo onda, degradê, pontos ou liso). Sem foto (ou com a foto padrão do template), mostra as iniciais. Nome e bio longos são cortados com reticências. O conteúdo fica no miolo, onde o WhatsApp recorta em quadrado.
- Fontes do catálogo em `assets/fonts/` (Plus Jakarta Sans, Instrument Serif, Space Grotesk, Bricolage Grotesque; licença OFL em `assets/fonts/OFL-*.txt`): a capa usa a fonte do modelo sem depender da rede no build.
- A capa sai em JPG 1200 x 630 abaixo de 300 KB (acima disso o WhatsApp não mostra a capa grande) em `/capa.jpg`, no lugar do PNG de `opengraph-image`. A foto pode ser arquivo de `public/` ou do Storage do painel; se não abrir, a capa sai com as iniciais.
- Capa própria pelo painel (Contato e site > Capa ao compartilhar, `site.share`): imagem (recomendado 1200 x 630; outra proporção é recortada no centro), título e texto do link. Cada um é opcional e substitui só a sua parte. O `npm run check` confere a imagem como confere a foto.
- Meta tags completas: `og:url`, `og:site_name`, `og:image:alt`, `og:image:type` e o mesmo título, texto e imagem no `twitter:*`. A URL da imagem leva um `?v=` que muda quando nome, @, bio, foto, visual ou capa mudam, para o WhatsApp e o Facebook baixarem de novo.
- `site.url` ainda do exemplo: as URLs absolutas (og:url, og:image) usam o domínio de produção da Vercel (`VERCEL_PROJECT_PRODUCTION_URL`, senão `VERCEL_URL`), para a capa não apontar para um domínio que não existe.
- A capa é refeita na hora em que o painel publica (a rota é estática e usa a mesma tag de cache da página).
- Testes: `tests/compartilhar.test.ts` (corte de texto, iniciais, endereço, capa própria x automática, metadados, schema), `tests/capa.test.ts` (os 6 modelos em claro e escuro, sem foto, texto longo, capa própria: JPG 1200 x 630 abaixo de 300 KB), `tests/check.test.ts` (capa ausente ou de outro site); `e2e/capa.spec.ts` (meta tags e imagem da bio do exemplo) e `e2e/capa-publicada.spec.ts` (projeto próprio, roda por último: com foto e com capa própria publicadas pelo painel, depois volta ao arquivo).

### Painel: UI/UX
- Nome do bloco escondido na cor secundária (4,5:1) em vez de transparente (ficava em 3,4:1); o teste de contraste passa a medi-lo.
- Foco no computador (1024 a 1440 px). Cada seção diz, logo abaixo do título, o que é e onde aparece na bio ("O topo da bio: foto, nome, @..."), e cada bloco aberto começa com uma linha explicando o que ele mostra. Textos em `lib/admin/ajuda.ts`.
- Dicas de onde cada campo aparece: nome, bio, etiquetas, foto e redes do Perfil; título, descrição e botão da oferta; categoria do produto; WhatsApp ("recebe as mensagens de todos os botões") e endereço do site. Valem antes da dica genérica do campo.
- Lista de blocos: seta "Editar"/"Fechar" em cada linha (antes nada dizia que o nome abria o bloco; o texto aparece a partir de 1400 px, a seta sempre), "Na bio"/"Escondido" ao lado da chave, nome em cada ação ao passar o mouse, e o Apagar separado das outras ações por um fio. No celular a linha continua como estava.
- Erro no bloco certo: o erro do bloco 14 acendia em vermelho também o bloco 1 (a comparação era por prefixo sem o ponto). Vale para blocos, ofertas, produtos, itens e "Avançado".
- "Corrija para publicar": tocar no problema abre a seção, abre o bloco (antes só trocava de seção) e leva a tela ao campo, já com o cursor nele.
- Topo: a confirmação do Descartar pergunta "Voltar tudo ao que está no ar?" e põe o Cancelar entre o Descartar vermelho e o Publicar; o Publicar ganhou um respiro e diz ao passar o mouse por que está apagado ("Nada novo para publicar", "Corrija os campos marcados para publicar").
- Bloco com erro deixava de pintar de vermelho as escolhas certas dele (Cabeçalho, Redes, Estilo): só o controle do campo com problema fica vermelho.
- Computador estreito (900 a 1080 px, ex.: 1024): a prévia fica ao lado do conteúdo, com o menu em abas em cima. Antes ela sumia e virava o botão flutuante do celular, que ainda cobria a seta de descer dos blocos.
- Aparência e demais escolhas de 4 opções ou mais ocupam a linha inteira (em meia coluna quebravam em duas linhas). A dica do "Padrão" dentro de Aparência deixa de mandar para a própria Aparência: "Padrão: o que o modelo escolhido acima usa."
- Listas: botão de adicionar no singular ("Adicionar oferta", "Adicionar produto", "Adicionar rede", "Adicionar depoimento", no lugar de "Adicionar ofertas" e "Adicionar produtos da vitrine"); oferta e produto fechados mostram preço e categoria ao lado do nome.
- Adicionar bloco avisa que o bloco novo entra no fim da bio e que as setas levam ao lugar certo. Final sem oferta do concierge mostra o texto padrão dentro do campo vazio.
- Versões e login sem jargão: "Arquivo original" explica "o conteúdo inicial da bio" em vez de citar o `linkbio.config.ts`; o login diz que nada vai para o ar sem Publicar, e o que se digita no e-mail deixa de sair em negrito.
- A prévia segue a edição: abrir um bloco (ou pôr o cursor num campo dele) rola a prévia até ele e o contorna em azul por um instante. Vale para a oferta (na seção Ofertas ou dentro do bloco de cards, vai ao card dela), o produto da Vitrine, o Perfil (topo) e o WhatsApp de Contato (primeiro botão de WhatsApp da bio). O cursor continua no campo; passar de um campo a outro do mesmo bloco não mexe na prévia; com "reduzir movimento" do sistema, salta sem animar. No celular, vale ao abrir a prévia. O contorno e as marcas que acham cada bloco existem só na prévia: a bio publicada não muda. Testes: `e2e/previa-segue.spec.ts` e `tests/previa-foco.test.ts`.
- Testes: 5 casos novos no `e2e/painel.spec.ts` (ordem dos botões do topo e da confirmação, dicas de seção, bloco e campo, problema que abre o bloco certo com o campo em foco, prévia ao lado em 1024 px, botão no singular e preço no item fechado); seletores atualizados para "Adicionar oferta"/"Adicionar produto" e `.c-item-nome`.
- Linha do bloco mais limpa: alça, ícone, nome e resumo, "Na bio"/"Escondido" com a chave e um botão "..." (Mais ações). Subir, Descer, Duplicar e, separado no fim e em vermelho, Apagar (com a mesma confirmação) moram no menu. Antes eram 6 controles soltos por linha. Clicar em qualquer ponto da linha abre e fecha a edição. O menu fecha com Esc (o foco volta ao "...") e com clique fora; setas, Home e End andam entre os itens. No celular é o mesmo menu, com 44 px de toque, e o "Ver prévia" flutuante sai da frente enquanto ele está aberto.
- Arrastar para mudar a ordem de verdade no computador: segurar a alça e levar o bloco (as outras linhas abrem espaço; perto da borda a página rola junto). Feito com pointer events, sem biblioteca. Pelo teclado: setas para cima e para baixo na alça, ou Alt + setas com o foco no nome do bloco; o leitor de tela ouve a posição nova ("Vídeo agora na posição 3 de 8") e o foco acompanha o bloco. Antes a alça usava o arraste do HTML5 e não tinha alternativa por teclado.
- Oferta e produto em grupos com título curto, na ordem do card: Texto (título e descrição), Preço, Botão e destino (link, mensagem do WhatsApp e texto do botão, com a dica de que com os dois o botão abre o link), Capa (ou Foto, no produto) e Avançado. Vale na seção Ofertas, na Vitrine e na oferta editada dentro do bloco Ofertas. As dicas de onde cada campo aparece continuam. Grupos em `GRUPOS` (`lib/admin/rotulos.ts`).
- Bloco, oferta ou item novo não aparece com erro vermelho antes de a pessoa preencher: o erro de um campo dele só aparece depois de sair do campo ou de tentar publicar. Enquanto isso o selo do topo diz "Falta preencher N campos" (em âmbar) e o Publicar continua sem publicar: tocar nele mostra a lista, que diz "falta preencher" para campo vazio (inclusive o "https://" com que o link novo nasce) e mantém as outras mensagens. As regras de validação não mudaram; campo que já existia e ficou vazio continua avisando na hora.
- Testes: 5 casos novos no `e2e/painel.spec.ts` (menu "..." com Subir, Descer, Esc, clique fora e Apagar com confirmação; arrastar muda a ordem e vai para o rascunho; teclado reordena e anuncia; grupos da oferta e do produto; bloco novo sem vermelho até sair do campo e "falta preencher" ao tentar publicar) e 1 no `e2e/painel-celular.spec.ts` (menu com 44 px, Esc e confirmação). Seletores dos casos antigos atualizados para o menu "...".
- Modo escuro do painel: com o sistema (computador ou celular) no escuro, o painel fica escuro sozinho, sem botão novo. Escuro em camadas, não inversão: fundo, cartão, realce e menu "..." cada um um degrau mais claro, bordas visíveis, vermelho, âmbar e verde claros o bastante para ler, e campos, listas de opção e barras de rolagem nativos no escuro (`color-scheme`). Todas as cores do painel viraram tokens em `admin.css` (inclusive topo, chave liga-desliga, seta do select, anéis de foco, confirmação, lista de problemas, login e o véu da prévia no celular); o claro ficou idêntico, pixel a pixel, em 18 telas (1280 e 375 px). A prévia não muda: mostra a bio no tema dela. Sem seletor manual de propósito: a prévia já tem "Auto/Claro/Escuro" que muda a bio, e um segundo controle igual para o painel confundiria; seguir o sistema também não pisca na carga.
- Testes: `e2e/painel-contraste.spec.ts` (projeto próprio, roda depois dos três motores) mede no claro e no escuro, em 1280 e 375 px, o contraste de todo texto visível contra o fundo real (login, as 7 seções, bloco aberto, menu "...", confirmação de apagar, escolher bloco, lista de problemas, prévia aberta no celular): 4,5:1 texto, 3:1 texto grande; no escuro, também fundo da página escuro, nenhuma superfície clara e 3:1 em borda de campo, chave ligada e foco. Falhava antes (painel claro com o sistema no escuro) e passa agora: menor razão de texto 5,4:1 no claro e 5,34:1 no escuro; componentes 3,11:1 no escuro.

## v0.3.0 (2026-09-30)

### Painel: tudo editável
- Testes do painel que dependem das ofertas do exemplo usam `tests/fixtures/config-exemplo.ts`, não o `linkbio.config.ts`: na bio de cada pessoa (outras ofertas) o `npm run check` ficava vermelho.
- CI do template roda os testes e o check também como "outra pessoa" (`scripts/config-outra-pessoa.ts`: bio sem oferta, outros ids), para esse tipo de quebra não voltar.
- Vídeo: o campo virou "Link do vídeo no YouTube". O leigo cola o link inteiro (watch?v=, youtu.be, shorts, embed, live, com ou sem `&t=`/`?si=`) e o painel guarda só o código de 11 caracteres.
- WhatsApp: aceita "(11) 98765-4321", "+55 11 ...", "0055 ...". Ao sair do campo, tira os símbolos e acrescenta o 55 em número brasileiro sem o país (com "+" na frente, não acrescenta nada).
- Preço: aceita "R$ 1.290,50", "1290,50" e "1290.50". Antes "R$ 1.290,50" era ignorado em silêncio e "1290.50" virava R$ 129.050,00. Texto que não é preço mostra "Não entendi este preço" e não muda o valor guardado.
- Links (`url`, `more_url`): sem https ganham o `https://` ao sair do campo; `http://` vira `https://`.
- @ do perfil: sem @ ganha o @; link do Instagram ou do TikTok vira o @.
- Cupom: o código vai para maiúsculas, sem espaço e sem acento enquanto digita. "Válido até" usa o calendário do aparelho (antes pedia AAAA-MM-DD digitado).
- Oferta e produto novos pelas seções Ofertas e Vitrine nascem com identificador livre (`oferta-N`, `produto-N`) e, a oferta, com mensagem de WhatsApp como destino. Antes nasciam com 5 erros, um deles no identificador escondido em Avançado.
- Apagar oferta: sai sozinha dos blocos de cards e das perguntas de contexto do concierge (onde o painel não mostra a oferta e o leigo não tinha como consertar). Na 1ª pergunta ela fica, e o seletor "Leva para" mostra "Oferta apagada: escolha outra" (antes mostrava a primeira oferta como escolhida, e escolhê-la não mudava nada). Produto apagado sai das vitrines. Identificador trocado em Avançado leva cards, concierge e vitrine junto.
- Erros em português sem nome técnico: "Este campo deve ser um link completo, começando com https://" no lugar de "site.url deve ser uma URL externa com https"; referências viram frase ("Uma resposta leva para a oferta "x", que foi apagada: escolha outra em "Leva para""). A lista de problemas nomeia oferta e produto pelo título. O `npm run check` continua com a mensagem original, que cita o caminho do arquivo.
- Foto acima de 4 MB é reduzida no navegador antes de enviar (lado maior até 2400 px, JPG ou WebP). GIF e arquivo que não é imagem continuam recusados com o motivo.
- Fonte: "Uma fonte para tudo" ou "Títulos e texto separados" (`theme.font: { display, body }`), antes só pelo arquivo.
- Título da capa da oferta virou caixa de várias linhas (a dica mandava usar Enter para quebrar linha e o campo não quebrava). Ícone vazio diz "Sem ícone" em vez de "Padrão do modelo". Grupos de opções (Estilo, Layout, WhatsApp ou Link) ganham nome para leitor de tela.
- Apagar oferta, produto ou depoimento pergunta antes ("Apagar a oferta X? Ela sai também dos cards."), como o bloco já fazia. Antes a lixeira apagava na hora e só o Descartar recuperava.
- Ordem: as etiquetas do perfil ganham setas para trocar de lugar; no bloco Vitrine, com dois ou mais produtos escolhidos, a "Ordem na vitrine" tem Subir/Descer. Antes só dava pelo arquivo.
- Prévia no celular fecha com Esc e com o voltar do Android (antes o voltar saía do painel). Com a prévia fechada, o voltar continua o de sempre.
- Bio sem oferta: `offers` pode ficar vazio (ou sumir do arquivo); bio só de links é válida. Bloco de cards sem oferta não aparece na página (o check avisa), concierge sem oferta leva ao WhatsApp e o Concierge novo já nasce assim quando não há oferta. No painel dá para apagar a última oferta, e as seções Ofertas, Blocos > Ofertas e Concierge dizem "Nenhuma oferta ainda" e o que fazer. Antes o schema exigia ao menos 1 oferta.
- Testes: `tests/admin-normalizar.test.ts`, `tests/admin-mensagens.test.ts`, `tests/admin-referencias.test.ts`, bio sem oferta em `tests/schema.test.ts` e `tests/check.test.ts`; no `e2e/painel.spec.ts`, o leigo digitando do jeito dele, apagando oferta usada no concierge, montando a bio do zero e editando depois (no computador e no celular), a fonte separada, confirmar antes de apagar, a ordem de etiquetas e da vitrine e a prévia fechando com Esc e com o voltar; `e2e/painel-sem-oferta.spec.ts` (projeto próprio, roda por último) apaga todas as ofertas, publica, confere a bio no ar e cria a primeira de novo.

### Celular (QA)
- Rascunho salvo na hora ao esconder a página (trocar de app ou bloquear a tela antes dos 600 ms do salvamento automático perdia a última edição).
- Painel: todo campo com letra de 16 px abaixo de 1080 px. Com 14 px, o iPhone dava zoom na página a cada toque num campo (inclusive no login) e não desfazia.
- Painel: digitando, o topo e a barra de abas deixam de grudar e o "Ver prévia" sai da frente. Com o teclado aberto eles ocupavam quase toda a tela que sobrava e o campo ficava atrás deles.
- Painel: Publicar num lugar fixo no celular (selo na linha de cima, botão no canto direito da de baixo) e liberado enquanto o rascunho salva. Digitar e tocar direto em Publicar não publicava: o botão travava ou pulava de lugar no meio do toque e o toque se perdia em silêncio. Vale também para o preço, que só grava ao sair do campo.
- Painel: em 320 px o botão Apagar dos blocos ficava fora da tela; agora a lista cabe.
- Painel: bloco recém-adicionado rola até aparecer inteiro, com o nome abaixo das abas (antes ficava pela metade, atrás do topo).
- Painel: select com aparência própria (no Safari ele ficava com 23 px de altura, sem borda nem padding); "Avançado" e as opções de "Adicionar bloco" com 44 px de toque.
- Testes: `e2e/painel-celular.spec.ts` (iPhone 14, Pixel 7 e 320 px) e um caso novo no `e2e/painel.spec.ts` (digitar e publicar na hora).

### Supabase sempre ativo
- O plano grátis do Supabase pausa o projeto após 7 dias sem atividade, e aí a bio voltava em silêncio ao `linkbio.config.ts`. Agora uma cron diária da Vercel (`vercel.json`, `0 12 * * *`, dentro do limite de uma por dia do plano Hobby) chama `GET /api/keepalive`, que grava o horário numa linha única da tabela `keepalive` (upsert: nada acumula, o conteúdo da bio não é tocado).
- Migration nova `supabase/migrations/0003_keepalive.sql` (RLS ligada, sem acesso de anon/authenticated). Sem ela, a rota responde 500 pedindo para rodar a migration; sem Supabase configurado, responde `{ ok: true, skipped: "supabase-off" }`.
- `CRON_SECRET` opcional no `.env.example`: definido, a rota só aceita `Authorization: Bearer <CRON_SECRET>` (a Vercel manda sozinha nas crons).

### Correções do motor (revisão das skills)
- Painel: upload de imagem até 4 MB (antes a Server Action cortava em 1 MB, o padrão do Next). `serverActions.bodySizeLimit` em 4,2 MB, abaixo do corte de 4,5 MB da Vercel; o navegador recusa acima de 4 MB antes de enviar, com mensagem em português. O bucket continua aceitando 5 MB.
- Supabase: a "Secret key" nova (`sb_secret_...`) vai só no cabeçalho `apikey`, como manda a doc do Supabase; a `service_role` antiga (JWT) continua indo também em `Authorization: Bearer`. Vale para REST, Storage e `npm run admin:usuario`.
- Node: `engines` passa a `^22.12.0 || ^24 || >=26` (a faixa do vitest) e o repo ganha `.nvmrc` com `22`.
- Check: imagem de outro site (fora do Storage público do Supabase do projeto) vira erro com o caminho do campo, porque o `next/image` não carrega e a página quebra; a mensagem manda salvar em `public/` ou enviar pelo painel.
- Check: aviso (não erro) listando os campos que ainda têm conteúdo do exemplo (Marina Duarte, `exemplo.com`, cupom `BEMVINDA10`, vídeo de exemplo, depoimentos, FAQ, banner "Nova turma", imagens de exemplo).
- Check: sai a checagem de oferta do concierge que nunca disparava (o schema já confere).
- Playwright: `timeout` de 240 s no servidor do app (build + start em máquina lenta).

### Concierge
- Resposta sem oferta: `offer` passa a ser opcional em cada opção. Sem ele, o final do concierge vira convite para conversar no WhatsApp, com as respostas como contexto na mensagem. `title`, `cta` e `wa` da opção personalizam esse final. Serve para quem ainda não sabe qual oferta é a certa ("Ainda não sei"). No painel, o seletor de oferta ganha "Nenhuma (vai direto para a conversa)".

### Painel no celular
- "Sair" no topo abaixo de 1080 px (antes só existia no rodapé do menu, escondido no celular).
- A barra de abas gruda logo abaixo do topo, que muda de altura quando quebra linha, e não cobre mais o título da seção.
- Alvos de toque de 44 px no celular: botões de ação, chaves de liga e desliga, campos, abas, X das etiquetas.
- Nada estoura a largura (Ofertas e Vitrine alargavam a página); nomes longos quebram linha em vez de serem cortados; o botão "Ver prévia" não cobre o fim do conteúdo.

### Voltar ao arquivo original
- Em Versões, "Arquivo original" com Restaurar: publica o conteúdo do `linkbio.config.ts` como versão nova (nota "restaurada do arquivo original"). A primeira publicação pelo painel deixa de ser sem volta; o histórico continua inteiro.

### Skills do Claude Code
- 6 skills em `.claude/skills/`: `setup-linkbio`, `editar-bio` (conteúdo e visual, com `referencias/campos.md`, `visual.md` e `concierge.md` lidas só quando o pedido precisa), `ligar-painel`, `publicar`, `atualizar-template` e `novo-bloco` (só para o que nenhum dos 16 tipos faz). O README e o `CLAUDE.md` deixam de prometer skills que não existem; `ligar-ia` e `ligar-agenda` chegam com essas funções.
- Regras comuns ficam no `AGENTS.md` (o `CLAUDE.md` só aponta para ele): como falar com quem nunca programou, como saber se a bio lê do arquivo ou do painel sem abrir o `.env.local`, validar e mostrar (com os avisos de exemplo esperados), o que nunca passa pelo chat.
- Testadas numa cópia do zip e conferidas contra o código: Node 22.12+, foto até 4 MB, imagem só local ou do painel, `mode` que cada modelo tem, `radius` e `corners` como o motor aplica, `reason` em toda resposta da 1ª pergunta, erro do `tsc` que cita a config é da config.
- Fluxos do leigo: resumo antes de escrever a config, preço perguntado em reais, `gh` logado pela própria pessoa em outra janela, `git init -b main`, variáveis coladas na importação da Vercel, senha do painel e segredo de sessão fora da conversa, qual chave do Supabase usar, domínio explicado pelo registrador, atualização a partir do zip sem apagar o que a pessoa criou.
- `npm run admin:segredo`: grava o `ADMIN_SESSION_SECRET` no `.env.local` sem mostrar o valor. `admin:usuario` passa a ler a última linha de cada variável (como o Next), então linha duplicada no `.env.local` não quebra mais.
- Gate do zip também procura chaves no formato novo do Supabase (`sb_secret_`, `sb_publishable_`).
- CI: os testes de navegador (que esperam o visual do exemplo) rodam só no repo do template ou onde a variável de repositório `LINKBIO_E2E` for `true`. A bio de quem trocou o visual roda só o `npm run check` e não recebe mais "falhou" a cada envio.
- Texto: `pulse` é um ponto verde de "online" (não pisca); ao trocar de modelo, o `theme` herdado do exemplo sai.

### Painel: concierge e cards com editor próprio
- Concierge: a regra fica escrita no topo do bloco ("a 1ª pergunta decide o final; as outras vão como contexto na mensagem"). A 1ª pergunta aparece como "Decide o final" e cada resposta mostra, na mesma linha, o texto, "Leva para" (uma oferta ou a conversa no WhatsApp) e a explicação do final; o final sem oferta ganha título, botão e mensagem próprios. As outras perguntas ("Contexto") mostram só a pergunta e as respostas. Adicionar, mover e remover perguntas e respostas, com ids gerados sozinhos.
- `reason` passa a ser obrigatório só nas respostas da 1ª pergunta (nas outras nunca aparece).
- Cards: cada oferta do bloco é editada dentro dele (título, descrição, preço, botão, capa), sem ir à seção Ofertas; mudar a ordem, tirar do bloco, incluir oferta existente ou criar uma nova ali mesmo (nasce com mensagem de WhatsApp como destino).

- Painel: campos da resposta do concierge com nome próprio ("Texto da resposta", "Título do final (sem oferta)" etc.), com dica de quando valem; na lista, a resposta aparece pelo texto dela, não pelo título do final.
- Check avisa quando `title`, `cta` ou `wa` de uma resposta são ignorados (fora do 1º passo ou com `offer`).
- Concierge marca `data-pronto` depois da hidratação; os testes esperam por ele (o clique antes disso se perdia no Firefox e deixava o teste instável).
- `.env.example` e a skill `publicar` deixam claro que pixel, GA4, aviso de lead e IA ainda não existem; a skill `atualizar-template` preserva `app/instance.css`; `ligar-painel` usa o SQL Editor como caminho principal; `supabase/.temp/` no `.gitignore`; amostra de cor com 44 px no celular.

### Limpeza
- `.env.example` lista `GA4_MEASUREMENT_ID` e `RESEND_API_KEY`, que o check já conferia; o check deixa de aceitar `NEXT_PUBLIC_SUPABASE_URL`, que nenhum código lê.

### Painel /admin
- `/admin` com login por e-mail e senha (scrypt, sessão em cookie assinado, 5 tentativas por 15 minutos) e editor de toda a config, montado do próprio schema: perfil, aparência, blocos (ordem, liga e desliga, adicionar, duplicar, apagar), ofertas, vitrine, contato, versões com restaurar, envio de imagem e prévia da bio publicada.
- A config publicada passa a vir do banco (`site_config`), validada pelo mesmo `ConfigSchema`; o `linkbio.config.ts` é o ponto de partida e a reserva. A página continua estática e é revalidada ao publicar.
- Campos de imagem aceitam URL https (imagens do painel) além de arquivo em `public/`.
- Nova migration `supabase/migrations/0001_admin.sql`, comando `npm run admin:usuario`, env `ADMIN_SESSION_SECRET`.
- A bio vai para o grupo `app/(site)`; o `/admin` tem layout próprio, sem o tema da bio.
- Rascunho automático (600 ms depois da última edição, tabela `site_config_rascunho`, migration `0002_rascunho.sql`): a prévia da lateral mostra o que está sendo editado, sem mexer no que está no ar; Publicar e Descartar no topo, com o estado sempre visível.
- Prévia ao vivo: o quadro da prévia (rota interna `/admin-previa`) carrega uma vez e recebe cada edição por `postMessage`, sem recarregar o iframe e sem ir ao servidor. Antes, cada tecla custava 2 a 3,5 s — o rascunho ia ao banco e só então o quadro inteiro era recarregado com duas consultas repetidas. A prévia valida o que recebe com o mesmo `ConfigSchema` do build: estado inválido no meio da digitação não chega à tela, ela segue mostrando a última coisa que publicaria. Mantém a rolagem, os três tamanhos e auto/claro/escuro, que agora trocam sem recarga.
- A sessão e a config publicada passam por `cache()` do React: o layout e a page da mesma requisição dividem uma consulta só.
- Painel redesenhado: menu lateral, cartões com espaçamento padronizado, controles segmentados, interruptores, etiquetas, preço em R$, cor, imagem com arrastar e soltar, blocos com ícone e arrastar para reordenar, escolha visual de bloco novo, galeria de modelos com as cores de cada um, campos avançados recolhidos.

## v0.2.0 — 2026-09-25 · Fase V (visual e modelos)

Resumo: 6 modelos prontos, opções visuais em `config/opcoes.ts` (listadas no README),
blocos novos (`banner`, `links`, `testimonials`, `faq`, `products`, `coupon`), vitrine
com catálogo, cupom e checagem de contraste das cores trocadas. Compatível com a
v0.1.0: configs antigas continuam válidas, exceto preset ou fonte fora da lista (ver L1, "Quebra"). Sem JavaScript novo no navegador
(primeira carga em 138,4 KB gzip, teto 150).

### Auditoria (achados de uma revisão independente, todos corrigidos)
- Cupom: fundo passa a `--surface`. O texto de apoio sobre o fundo tingido ficava em 4,20:1 no modelo neutro (abaixo de AA).
- Id de bloco repetido dá erro (dois `products` com o mesmo id quebravam o filtro do segundo); id gerado da vitrine sem id usa `_`, fora do formato de slug, e não colide com id escrito à mão.
- `theme.font: "serif"` e `"bricolage"` mudam só os títulos; o texto corrido fica na Jakarta, como diz o catálogo.
- Todas as mensagens de campo vazio em PT-BR (algumas saíam em inglês).
- Todos os blocos rejeitam campo desconhecido (erro de digitação como `open_first` passava calado).
- Banner com `action` exige `label` (o botão sumia sem aviso). `theme.palette` de um modo que o modelo não tem dá erro (era ignorada em silêncio).
- Categoria do catálogo: espaço sobrando é aparado; vazia ou "Todos" dá erro.
- Filtro da vitrine: etiquetas com 44 px de altura; cada rádio diz "Filtrar por categoria: X" ao leitor de tela.
- Cards: `price_cents: 0` mostra "Grátis", como na vitrine.
- Gate do zip: pega celular escrito à mão (com ou sem 55, com parênteses, espaço ou hífen) e só libera a marca no `README.md` da raiz.
- Remove prop sem uso do concierge.

### Liga e desliga
- Cupom ganha `copy` (padrão desligado): botão "Copiar" que põe o código na área de transferência (sem permissão, seleciona o código). Ilha client de ~0,1 KB que recebe só o código; o toque no código continua funcionando sem JavaScript.
- Todo bloco aceita `enabled: false`: sai da página (e do cálculo do banner in-app) sem apagar o conteúdo da config. `lib/blocos.ts` (`blocosAtivos`) é a regra única, usada pela página, pelo layout e pelos testes.
- `check.ts` avisa quando todos os blocos estão desligados.
- README ganha a tabela "Liga e desliga" com todas as chaves que ligam e desligam recursos; o exemplo traz um bloco desligado.

### L11 · Release
- README: seções "Modelos prontos", "Blocos" (os 16 tipos), vitrine, cupom e "Todas as opções visuais", esta gerada de `config/opcoes.ts` por `npm run readme` (teste falha se ficar desatualizada).
- Versão 0.2.0 no `package.json`.
- Títulos (`h1` a `h3`) herdam a cor do bloco, e o código do cupom zera fundo e respiro: um CSS de instância que pinta todo `h2` ou todo `code` não apaga mais o título do concierge escuro nem enfeita o cupom (achado na sincronização da instância).
- Exemplo com catálogo fictício e cupom.
- Gate do zip: a regra de "cara de chave" reprovava o `globals.css` desde o L5 (a propriedade `mask-image` contém as letras da regra). Agora pega só chave com formato real (prefixo solto + 16 caracteres) e token JWT; testes cobrem os dois lados.

### Contraste das cores trocadas
- `check.ts` confere o contraste AA de todas as paletas do tema (modelo + `theme.palette`): texto e texto de apoio sobre fundo e cards (4,5:1), botão principal e bloco em destaque (4,5:1), linhas decorativas (3:1). Cor ilegível quebra o check com o par, a razão e o mínimo, em PT-BR.
- Nova função `problemasDeContraste` em `lib/theme.ts` (a mesma regra dos testes dos modelos).

### L10 · Cupom
- Novo bloco `coupon`: `code` (maiúsculas, números, `-` e `_`), `label` (o que o cupom dá), `expires` (AAAA-MM-DD, validada no calendário), `cta` e `action` (WhatsApp ou URL).
- Sem JavaScript: um toque no código seleciona o código inteiro e o celular oferece "Copiar". Botão de copiar fica para depois (precisa de OK, porque seria mais uma parte com JS).
- `check.ts` avisa quando o cupom vence (aviso, não erro: a página continua publicando).
- Borda tracejada na cor de destaque com contraste AA; botão com as cores de CTA do modelo e 44 px de altura; abaixo de 360 px o botão desce para a linha de baixo.

### L9 · Catálogo e vitrine
- `catalog` na raiz (opcional): produtos com `id`, `title`, `url`, `image`, `price_cents`, `price_label`, `category` e `cta`. Separado das ofertas do concierge; preço é sempre número (0 vira "Grátis").
- Novo bloco `products`: vitrine com `layout` (`carrossel`, `grade`; sem valor, vem do modelo), `items` (ids do catálogo; sem valor, o catálogo inteiro) e `filter`.
- Filtro por categoria só com CSS (rádios nativos, funciona sem JavaScript e pelo teclado), até 6 categorias, com a contagem em cada filtro.
- Sem foto, a capa do produto é gerada com as cores do modelo e mostra a categoria.
- Responsivo: no celular o carrossel rola dentro do bloco com a borda esmaecida; a partir de 640 px, grade de 3 colunas e filtros em várias linhas.
- Schema: ids repetidos em `offers` ou `catalog` dão erro; `products` exige catálogo e valida os ids.
- `check.ts`: `items` só é conferido como id em `cards` (ofertas) e `products` (catálogo), sem o falso positivo; passa a conferir as imagens de `offers[].cover` e `catalog`.

### L8 · Blocos de conteúdo
- Novo bloco `banner`: aviso em destaque com `title`, `text` e botão opcional (`label` + `action`); fundo `--accent-fill` com texto branco AA.
- Novo bloco `testimonials`: até 10 depoimentos (`quote`, `name`, `role`, `avatar`); carrossel no celular, grade a partir de 640 px. Use só depoimento real na página publicada.
- Novo bloco `faq`: até 12 perguntas com `details`/`summary` (funciona sem JavaScript) e `openFirst`.
- Galeria em quadrados com borda; vídeo com botão de play redondo.
- Exemplo atualizado com banner, depoimentos (marcados como exemplo) e perguntas frequentes.

### L7 · Concierge
- Bloco `concierge` ganha `variant` (`destaque`, card escuro do modelo; `leve`, card claro com borda) e `collapsed` (começa recolhido, abre ao tocar). Sem `variant`, vem do modelo; `collapsed` é falso por padrão.
- Perguntas em lista de opções com seta e barra de progresso; recomendação num card com as cores invertidas do bloco (não some no fundo).
- Acessibilidade: o foco vai para a próxima pergunta e para a recomendação; corpo com `aria-live`; conteúdo recolhido sai da leitura e do foco; título continua `h2` quando o cabeçalho não é botão.
- Os `data-testid` (`concierge`, `cc-chip-*`, `cc-recomendacao`, `cc-cta`) e o botão "Recomeçar" não mudam.

### L6 · Links
- Bloco `link` ganha `subtitle` e `image`; com um deles, vira card (miniatura, título, subtítulo e seta).
- Novo bloco `links`: grupo de até 12 links com `layout` (`lista`, `botoes`, `icones`); sem valor, vem do modelo. Alvo de toque de 44 px; na grade de ícones, 2 colunas abaixo de 340 px.
- Exemplo atualizado: link em card e grupo "Me acompanhe".

### L5 · Ofertas
- Bloco `cards` ganha `layout` (`carrossel`, `lista`, `grade`, `destaque`); sem valor, vem do modelo.
- `offers[].cover`: capa do card com `image`, `headline`, `tag` e `tone` (`escuro`, `claro`, `gradiente`). Sem imagem, a capa é composta com as cores do modelo.
- Responsivo sem cortes: no celular o carrossel rola dentro do bloco e o card seguinte esmaece na borda; a partir de 640 px vira grade de 2 colunas.
- Ações do card e "saiba mais" com alvo de toque de 44 px.

### L4 · Perfil
- Bloco `profile` ganha `header` (`centro`, `capa`, `lado`), `socials` (`icones`, `nomes`, `oculto`) e `cover` (imagem da capa; sem imagem, a capa é gerada com as cores do modelo). Sem valor, vem do modelo.
- `profile.socials`: redes no cabeçalho, com alvo de toque de 44 px e nome acessível igual ao texto visível.
- Bloco `text` ganha `variant: "rodape"` (vira `<footer>`).
- Exemplo atualizado: redes no perfil, CTA com legenda e ponto de online, rodapé.

### L3 · Variantes globais e CTA
- `theme.background` vira camada de fundo (`onda`, `gradiente`, `pontos`, `liso`) via `<html data-fundo>`.
- `theme.buttons` (`pilula`, `suave`, `contorno`, `brutal`) via `<html data-botoes>`; brutal leva borda grossa e sombra dura também aos cards e ao concierge.
- CTA principal usa as cores de CTA do modelo (`--cta-bg`/`--cta-text`), não mais o accent. Links viram botões de superfície; ação do card fica vazada (alvo de toque de 44 px).
- Bloco `cta` ganha `variant` (`primario`/`secundario`), `note` e `pulse`.
- Entrada escalonada dos blocos a partir do 3º, desligada com reduzir movimento.

### L2 · Fontes
- As 4 famílias do catálogo (`jakarta`, `serif`, `grotesk`, `bricolage`) servidas por `next/font` em `lib/fontes.ts`. Só a Jakarta é pré-carregada; as outras só baixam quando o modelo usa.
- Títulos usam `--font-display` com peso e espaçamento do modelo.
- Remove o `--font-next` sem uso.

### L1 · Fundação de tema
- 6 modelos prontos em `config/presets/` (`neutro`, `noite`, `editorial`, `vitrine`, `brutal`, `vibrante`), com contraste AA testado em `tests/presets.test.ts`.
- `config/opcoes.ts`: catálogo das opções visuais com rótulo e descrição (fonte única do schema e das mensagens de erro).
- `theme` ampliado: `preset` (default `neutro`), `mode`, `accent`, `palette`, `font` (chave ou `{ display, body }`), `background`, `buttons`, `corners`. Tudo opcional, sobrescreve o modelo.
- Compatível com a v0.1.0: `preset: "neutro-claro"`, `font: "Plus Jakarta Sans"` (e as outras 3 fontes pelo nome) e `radius` continuam válidos.
- `lib/resolver.ts` resolve modelo + config; `lib/theme.ts` gera tokens por paleta (`--bg`, `--surface`, `--text`, `--dim`, `--line`, `--cta-*`, `--shell-*`, `--accent-fill` e outros) com especificidade zero (`:where`).
- Cores de texto, fundo e borda do `globals.css` vêm dos tokens do modelo (ficam literais só as capas geradas e o texto branco sobre fundo cheio); `:focus-visible`; imagem OG lê o tema resolvido.
- Corrige a fonte: a Plus Jakarta Sans do `next/font` passa a ser aplicada.
- **Quebra:** `theme.preset` e `theme.font` fora da lista agora dão erro, com as opções na mensagem (na v0.1.0 os dois aceitavam texto livre; as 4 fontes antigas por nome continuam valendo).

## v0.1.0 — 2026-09-23

F1 · Base estática: scaffold Next, schema da config em zod, tema via tokens,
blocos estruturais + `youtube`/`gallery`, og image, JSON-LD, banner in-app,
concierge em modo roteiro, `npm run check`, gate do zip e empacotamento por
`git archive` a partir de tag.
