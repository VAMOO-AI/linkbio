#!/usr/bin/env bash
# Mac sem Homebrew: baixa o instalador .pkg da versão mais nova do GitHub CLI (gh), confere o sha256
# contra o checksums.txt da própria release e só abre se bater.
# Uso: bash scripts/instalar-gh.sh
set -u
. "$(dirname "$0")/instalador-comum.sh"

API="${GH_RELEASE_API:-https://api.github.com/repos/cli/cli/releases/latest}"
DOWNLOAD="${GH_DOWNLOAD_BASE:-https://github.com/cli/cli/releases/download}"
DESTINO="${DESTINO:-$HOME/Downloads}"

# Resposta inteira primeiro, filtro depois (sem cortar o curl no meio do pipe).
JSON="$(curl -fsSL "$API" 2>/dev/null)" || JSON=""
TAG="$(printf '%s\n' "$JSON" | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | awk 'NR == 1')"
ESPERADO=""
URL=""
if [ -n "$TAG" ]; then
  V="${TAG#v}"
  PKG="gh_${V}_macOS_universal.pkg"
  SOMAS="$(curl -fsSL "$DOWNLOAD/$TAG/gh_${V}_checksums.txt" 2>/dev/null)" || SOMAS=""
  ESPERADO="$(printf '%s\n' "$SOMAS" | awk -v f="$PKG" '$2 == f { print $1; exit }')"
  URL="$DOWNLOAD/$TAG/$PKG"
fi
baixar_conferir_abrir "$URL" "$DESTINO/gh.pkg" "$ESPERADO"
