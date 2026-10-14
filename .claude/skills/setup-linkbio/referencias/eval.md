# Eval do setup

Régua da bio que a skill de setup escreve. Roda no computador, sem rede e sem Apify: a coleta do caso já está na fixture.

A pasta `fontes/` é o que `npm run analisar` gravaria em `analise/`. O zip do template recusa uma pasta com o nome `analise` em qualquer lugar do repositório, então a fixture não usa esse nome. Na cópia de trabalho, copie `fontes/` para `analise/`.

## Depois de mexer na skill

1. Escolha o caso em `tests/fixtures/eval/`: `prestadora` (site e Linktree), `loja` (muitos produtos, sem site), `mentor` (uma oferta, sem concierge) ou `poucas-legendas` (pouco texto, sem site).
2. Numa cópia da pasta do template, fora do git:
   `mkdir -p /tmp/eval-prestadora && cp -R tests/fixtures/eval/prestadora/fontes /tmp/eval-prestadora/analise`
3. Rode o setup nessa cópia. A coleta já está em `analise/`: não rode `npm run analisar` (isso usaria a rede). O agente lê os JSON, confirma e escreve `linkbio.config.ts`.
4. Na pasta do template:
   `npm run eval:setup -- prestadora /tmp/eval-prestadora/linkbio.config.ts`
5. A nota vai de 0 a 10. O gabarito bom de cada caso tira 8 ou mais; abaixo de 8 o comando termina com erro. `--json` imprime o mesmo relatório em JSON.

Critérios: fidelidade de ofertas, links e WhatsApp, voz, nada inventado, visual (modelo aceito e cor de destaque perto da marca), nada do exemplo, check verde.

O que a bio tem de ter está em `esperado.json`. `boa.json` passa. `ruim.json` planta um defeito em cada critério.
