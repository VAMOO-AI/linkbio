#!/usr/bin/env bash
# Junta supabase/migrations/*.sql em ordem de nome.
# Uso, na raiz do repositório:
#   bash scripts/sql-instalar.sh                  # imprime
#   bash scripts/sql-instalar.sh caminho.sql      # imprime e grava
# SQL_INSTALAR_QUIETO=1 suprime a impressão (a gravação continua).
# Migration sem "if not exists" nem "on conflict" gera AVISO em stderr e não falha.
set -euo pipefail

SAIDA="${1:-}"
DIR="supabase/migrations"
if [[ ! -d "$DIR" ]]; then
  echo "ERRO: não achei $DIR (rode na raiz do repositório)." >&2
  exit 1
fi

ARQS=()
while IFS= read -r arq; do
  ARQS+=("$arq")
done < <(find "$DIR" -maxdepth 1 -type f -name '*.sql' | sort)

if [[ ${#ARQS[@]} -eq 0 ]]; then
  echo "ERRO: nenhuma migration em $DIR." >&2
  exit 1
fi

TMP=$(mktemp)
{
  echo "-- Gerado por npm run sql:instalar. Não edite."
  echo "-- Junta supabase/migrations/*.sql em ordem de nome. Pode rodar de novo."
  echo
  for arq in "${ARQS[@]}"; do
    nome="$(basename "$arq")"
    if ! grep -qiE 'if not exists|on conflict' "$arq"; then
      echo "AVISO: $nome não usa if not exists nem on conflict; pode falhar na segunda execução." >&2
    fi
    echo "-- ===== $nome ====="
    cat "$arq"
    echo
  done
} > "$TMP"

if [[ -n "$SAIDA" ]]; then
  mkdir -p "$(dirname "$SAIDA")"
  cp "$TMP" "$SAIDA"
fi
if [[ "${SQL_INSTALAR_QUIETO:-}" != "1" ]]; then
  cat "$TMP"
fi
rm -f "$TMP"
