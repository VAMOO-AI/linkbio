#!/usr/bin/env bash
# Publica o mesmo conteúdo do zip (git archive da tag + instalar.sql) num repo de
# distribuição, como commit novo e a mesma tag, sem o histórico interno deste repo.
# Não cria o repositório: o remote já precisa existir.
# Uso: bash scripts/publicar-dist.sh vX.Y.Z <remote-ou-url>
set -euo pipefail

VERSAO="${1:-}"
REMOTE="${2:-}"
if [[ ! "$VERSAO" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ || -z "$REMOTE" ]]; then
  echo "ERRO: uso: bash scripts/publicar-dist.sh vX.Y.Z <remote-ou-url>"
  exit 2
fi
if ! git rev-parse --verify --quiet "$VERSAO" >/dev/null; then
  echo "ERRO: tag $VERSAO não existe. Crie com: git tag $VERSAO"
  exit 1
fi
if git ls-remote --tags "$REMOTE" "refs/tags/${VERSAO}" | grep -q .; then
  echo "ERRO: a tag $VERSAO já existe no repo de distribuição."
  exit 1
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
ARVORE="$TMP/arvore"
mkdir -p "$ARVORE"
bash scripts/preparar-arvore.sh "$VERSAO" "$ARVORE"
bash scripts/zip-gate.sh "$ARVORE"

WORK="$TMP/work"
if git ls-remote "$REMOTE" HEAD | grep -q .; then
  git clone --depth 1 "$REMOTE" "$WORK"
  find "$WORK" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
else
  git init -b main "$WORK"
fi
cp -R "$ARVORE"/. "$WORK"/
git -C "$WORK" add -A
if ! git -C "$WORK" diff --cached --quiet; then
  git -C "$WORK" -c user.name="linkbio-dist" -c user.email="linkbio-dist@localhost" commit -m "distribuição $VERSAO"
fi
git -C "$WORK" tag "$VERSAO"
git -C "$WORK" push "$REMOTE" HEAD:refs/heads/main
git -C "$WORK" push "$REMOTE" "refs/tags/${VERSAO}"
echo "OK: $VERSAO publicada em $REMOTE (sem o histórico interno)."
