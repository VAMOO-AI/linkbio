#!/usr/bin/env bash
# Gera o zip de distribuição do template a partir de uma tag.
# Nunca zipa a pasta de trabalho (ela pode levar .env.local, .context/, node_modules).
# Inclui supabase/instalar.sql, gerado das migrations da tag (não vem do git).
# Uso: bash scripts/package-template.sh v0.1.0
set -euo pipefail

VERSAO="${1:-}"
if [[ ! "$VERSAO" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "ERRO: informe a versão. Uso: bash scripts/package-template.sh v0.1.0"
  exit 2
fi
if ! git rev-parse --verify --quiet "$VERSAO" >/dev/null; then
  echo "ERRO: tag $VERSAO não existe. Crie com: git tag $VERSAO"
  exit 1
fi

SAIDA="$(pwd)/linkbio-${VERSAO}.zip"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/linkbio"
bash scripts/preparar-arvore.sh "$VERSAO" "$TMP/linkbio"
bash scripts/zip-gate.sh "$TMP/linkbio"
rm -f "$SAIDA"
( cd "$TMP" && zip -qr "$SAIDA" linkbio )

echo "OK: $SAIDA gerado da tag $VERSAO e aprovado no gate."
