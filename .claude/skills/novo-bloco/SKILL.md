---
name: novo-bloco
description: Cria um tipo de bloco que NÃO existe no motor (schema, componente, estilo, registry, painel e teste). Use quando a pessoa pedir algo que nenhum dos 19 tipos faz (ex.: contagem regressiva, mapa), e só depois de confirmar com ela. Tipos existentes: profile, cta, banner, concierge, cards, products, coupon, link, links, social, youtube, gallery, testimonials, faq, text, divider, lead, pix, agenda. Pedidos como "põe um vídeo", "adiciona depoimentos", "coloca perguntas frequentes", "quero uma galeria", "formulário de contato", "chave Pix", "agenda" ou "muda o jeito dos links" são editar-bio, não esta skill.
---

# Novo bloco

Esta é a única skill que mexe no motor. Antes, diga à pessoa qual bloco existente chega mais perto
(README, seção "Blocos"; variantes em `editar-bio/referencias/visual.md`) e siga só se ela confirmar
que nenhum serve. Se servir, use `editar-bio`.

Para a pessoa, diga só "vou criar um bloco novo, leva alguns minutos" e mostre o resultado: os
passos abaixo são para você.

Tudo o que o bloco aceitar é opção da config com valor padrão: o template é de todo mundo.

## Onde mexer (nesta ordem)

1. **Schema** (`config/schema.ts`): crie `NomeBlockSchema` com `type: z.literal("nome")`,
   `enabled`, `visivel: campoVisivel("bloco nome")` e `id` opcionais como nos outros, mensagens de erro em português com o caminho do campo,
   e `.strict()`. Inclua no union de blocos e na lista de tipos da mensagem "Tipos válidos".
   Se citar oferta ou produto, valide o `id` no `superRefine` como o concierge faz.
   Campo de imagem: use um destes nomes (`image`, `src`, `cover`, `poster`, `avatar`), que o check
   já confere.
2. **Componente** (`blocks/nome.tsx`): recebe só props. Sem `"use client"` se não precisar de estado.
3. **Estilo** (`app/globals.css`): classes do bloco usando as variáveis do tema (`var(--surface)`,
   `var(--text)`, `var(--dim)`, `var(--radius)`), como os outros blocos.
4. **Registry** (`blocks/registry.tsx`): um `case "nome"` passando as props.
5. **Painel**:
   - `lib/admin/rotulos.ts`: em `BLOCOS`, nome, descrição e o bloco novo padrão; em `CAMPOS`, o nome
     em português de cada campo novo; campo de imagem em `IMAGEM` (ganha envio), texto longo em
     `TEXTO_LONGO`, dica em `DICAS`; valor de lista escrito direto no bloco (ex.: `z.enum([...])`)
     ganha nome em português em `VALORES`; campo avançado vai em `AVANCADO`. Se o bloco tiver um
     título com outro nome, ensine `resumoDoBloco()` a mostrá-lo na lista.
   - `app/(admin)/admin/icones.tsx`: um ícone para o tipo (sem ele, vai o genérico).
   - O formulário é montado sozinho a partir do schema.
6. **Opções visuais** (se tiver variante): grupo em `config/opcoes.ts`, entrada em `CAMPO` de
   `scripts/readme-opcoes.ts`, padrão em cada `config/presets/*.ts` (e no tipo em
   `config/presets/tipos.ts`), depois `npm run readme`.
7. **Testes**: em `tests/schema.test.ts`, um caso válido e um inválido com a mensagem; em `e2e/`,
   um spec que renderiza o bloco e confere que nada estoura a largura em 375 px.
8. **Documentação**: linha na tabela "Blocos" do README e entrada no `CHANGELOG.md`.

## Validar

1. `npm run check` verde.
2. Testes do navegador: na primeira vez, `npx playwright install`. Depois
   `npx playwright test e2e/<spec> --project=chromium`. Ele faz build e usa as portas 3100 e 3155:
   feche qualquer servidor que esteja nelas antes.
3. Mostre o bloco com `npm run dev` em segundo plano (a pessoa abre o endereço que ele mostrar).
