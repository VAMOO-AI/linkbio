---
name: atualizar-template
description: Traz uma versão nova do template linkbio para a bio da pessoa sem perder o conteúdo dela. Use quando a pessoa pedir "atualizar o template", "tem versão nova", "chegou versão nova", "baixei o zip novo", "trazer as melhorias sem perder o que eu fiz" ou mencionar um linkbio-vX.Y.Z.zip novo.
---

# Atualizar o template

O que é da pessoa e NUNCA é sobrescrito nem apagado: `linkbio.config.ts`, os arquivos dela em
`public/`, `.env.local`, `app/instance.css` (estilo próprio da bio), `.git/`, `.vercel/`,
`node_modules/`, `supabase/config.toml`, `supabase/.temp/` e o que estiver no banco.
`CLAUDE.md` e `AGENTS.md` podem ter ajustes da pessoa: traga a versão nova e revise com `git diff`
antes de aceitar. O resto é motor e vem da versão nova.

## 1. Antes

1. Sem `.git`: `git init -b main`, `git add -A` e `git commit -m "antes da atualização"` (vira o backup e
   permite comparar). Com `.git`: `git status` limpo (commit do que estiver pendente).
2. Versão atual e nova: `version` no `package.json` e o topo do `CHANGELOG.md` de cada lado.
3. Leia o bloco `### Para quem usa` no topo da versão nova do `CHANGELOG.md` (até 3 linhas) e
   conte isso à pessoa, com essas palavras. Se o resto da versão citar campo novo, renomeado ou
   removido na config, diga também, em linguagem simples.
4. A pessoa criou bloco próprio (skill `novo-bloco`)? Veja com `git log` e `git diff` o que ela
   mudou no motor (`app/`, `blocks/`, `config/`, `lib/`, `tests/`): a versão nova sobrescreve esses
   arquivos. Guarde a lista e reaplique no passo 3.

## 2. Trazer a versão nova

Descubra qual caso é:

**A. O repo tem o remote `upstream`** (o repositório de distribuição; o endereço mora em
`config/distribuicao.ts`, no campo `URL_DISTRIBUICAO`. Confira com `git remote -v`):

1. `git fetch upstream --tags`
2. `git merge vX.Y.Z` (a tag dessa versão no upstream; ela não traz o histórico interno do template)
3. Conflito em arquivo da pessoa (`linkbio.config.ts`, `app/instance.css` ou algo em `public/`):
   fique com o dela (`git checkout --ours <arquivo>`) e aplique à mão só o que o CHANGELOG mandar
   mudar na config.
4. Conflito em arquivo do motor (`app/`, `blocks/`, `config/`, `lib/`, `tests/`): fique com a versão
   nova (`git checkout --theirs <arquivo>`) e reaplique o bloco próprio dela (passo 1.4).
5. `git status` sem conflito antes de seguir. Se não der para resolver, pare e mostre qual arquivo.

**B. A pessoa começou pelo zip** (sem `upstream`):

1. Se `../linkbio-novo` já existir (de outra atualização), apague antes. Descompacte numa pasta à
   parte: `unzip -q <caminho do zip> -d ../linkbio-novo`. Confira que
   existe `../linkbio-novo/linkbio/package.json` (o zip traz tudo dentro de `linkbio/`). No Windows:
   `mkdir ..\linkbio-novo` e `tar -xf <caminho do zip> -C ..\linkbio-novo`.
2. Copie o motor por cima, preservando o que é da pessoa (macOS e Linux):
   `rsync -a --exclude=/.git --exclude=/.vercel --exclude=/node_modules --exclude=/.next --exclude=/.env.local --exclude=/linkbio.config.ts --exclude=/app/instance.css --exclude=/supabase/config.toml --exclude=/supabase/.temp --exclude=/public ../linkbio-novo/linkbio/ ./`
   No Windows sem rsync, copie pasta por pasta (`app/`, `blocks/`, `config/`, `lib/`, `scripts/`,
   `tests/`, `e2e/`, `supabase/migrations/`, `.claude/` e os arquivos da raiz), menos os protegidos.
3. De `public/`, traga só o que ainda não existe, sem sobrescrever os da pessoa:
   `rsync -a --ignore-existing ../linkbio-novo/linkbio/public/ ./public/`.
4. Arquivo do motor que não existe no zip novo: apague só se o `git log` mostrar que veio do
   template, nunca algo que a pessoa criou. Na dúvida, mantenha.
5. Revise com `git diff` antes de seguir.

## 3. Validar

1. `npm install` (dependências podem ter mudado).
2. Com painel ligado e migration nova no CHANGELOG: quem ligou pelo SQL Editor roda lá só os
   arquivos novos de `supabase/migrations/`, em ordem; quem usou a CLI roda `npx supabase db push`.
3. Bloco próprio da pessoa (passo 1.4): reaplique as mudanças dela no motor novo.
4. `npm run check`. Erro de config por mudança da versão: corrija o `linkbio.config.ts` como o
   CHANGELOG indica.
5. Mostre ("Validar e mostrar" do `AGENTS.md`) e ofereça enviar para o site (skill `publicar`).
