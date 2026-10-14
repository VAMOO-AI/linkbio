#!/usr/bin/env bash
# Baixa o instalador da LTS do Node, confere o sha256 contra o SHASUMS256.txt oficial e só abre se bater.
# Uso: bash scripts/instalar-node.sh [pkg|msi]   (sem argumento: pkg no Mac, msi no Windows)
# atalho: fixo em latest-v24.x; revisar quando o Node 24 sair de LTS (abril de 2028)
set -u
. "$(dirname "$0")/instalador-comum.sh"

BASE="${NODE_DIST_BASE:-https://nodejs.org/dist/latest-v24.x}"
DESTINO="${DESTINO:-$HOME/Downloads}"
TIPO="${1:-}"
if [ -z "$TIPO" ]; then
  case "$(uname -s)" in
    Darwin) TIPO=pkg ;;
    MINGW*|MSYS*|CYGWIN*) TIPO=msi ;;
    *) echo "Sistema não suportado: use o instalador de nodejs.org."; exit 2 ;;
  esac
fi
case "$TIPO" in
  pkg) PADRAO='^node-v[0-9.]+\.pkg$' ;;
  msi) PADRAO='^node-v[0-9.]+-x64\.msi$' ;;
  *) echo "Uso: bash scripts/instalar-node.sh [pkg|msi]"; exit 2 ;;
esac

# Resposta inteira primeiro, filtro depois (sem cortar o curl no meio do pipe).
SOMAS="$(curl -fsSL "$BASE/SHASUMS256.txt" 2>/dev/null)" || SOMAS=""
LINHA="$(printf '%s\n' "$SOMAS" | awk -v p="$PADRAO" '$2 ~ p { print; exit }')"
ESPERADO="$(printf '%s' "$LINHA" | awk '{print $1}')"
NOME="$(printf '%s' "$LINHA" | awk '{print $2}')"
baixar_conferir_abrir "${NOME:+$BASE/$NOME}" "$DESTINO/node.$TIPO" "$ESPERADO"
