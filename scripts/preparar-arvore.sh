#!/usr/bin/env bash
# Monta o conteúdo distribuível de uma tag: git archive + supabase/instalar.sql.
# Os arquivos ficam na raiz do diretório (package.json na raiz, sem pasta linkbio/).
# Uso: bash scripts/preparar-arvore.sh vX.Y.Z <dir>
set -euo pipefail

VERSAO="${1:-}"
DEST="${2:-}"
if [[ ! "$VERSAO" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ || -z "$DEST" ]]; then
  echo "ERRO: uso: bash scripts/preparar-arvore.sh vX.Y.Z <dir>"
  exit 2
fi
if ! git rev-parse --verify --quiet "$VERSAO" >/dev/null; then
  echo "ERRO: tag $VERSAO não existe. Crie com: git tag $VERSAO"
  exit 1
fi

mkdir -p "$DEST"
git archive --format=tar "$VERSAO" | tar -x -C "$DEST"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
( cd "$DEST" && SQL_INSTALAR_QUIETO=1 bash "$SCRIPT_DIR/sql-instalar.sh" supabase/instalar.sql )
