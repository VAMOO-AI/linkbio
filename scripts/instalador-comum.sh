#!/usr/bin/env bash
# Funções dos instaladores (instalar-node.sh, instalar-gh.sh): conferir o sha256 e só então abrir.
# Saídas que a skill lê: ABERTO (abriu o instalador), DIFERENTE (hash não bate, arquivo apagado),
# SEM CHECKSUM (não deu para saber o hash esperado; nada foi baixado), FALHOU O DOWNLOAD.

sha256_de() {
  if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'
  else sha256sum "$1" | awk '{print $1}'; fi
}

abrir() {
  if [ -n "${ABRIR:-}" ]; then
    # shellcheck disable=SC2086 # ABRIR pode ter argumentos (o teste usa "echo ABRIU")
    $ABRIR "$1"
  elif [ "$(uname -s)" = "Darwin" ]; then
    open "$1"
  else
    start "" "$1"
  fi
}

# baixar_conferir_abrir <url> <arquivo local> <sha256 esperado>
baixar_conferir_abrir() {
  local url="$1" arquivo="$2" esperado="$3" obtido
  if [ -z "$esperado" ] || [ -z "$url" ]; then
    echo "SEM CHECKSUM: não achei o hash esperado; nada foi baixado."
    return 1
  fi
  mkdir -p "$(dirname "$arquivo")"
  if ! curl -fsSL -o "$arquivo" "$url"; then
    rm -f "$arquivo"
    echo "FALHOU O DOWNLOAD: $url"
    return 1
  fi
  obtido="$(sha256_de "$arquivo")"
  if [ -n "$esperado" ] && [ "$esperado" = "$obtido" ]; then
    echo "ABERTO: checksum conferido, abrindo $arquivo"
    abrir "$arquivo"
  else
    rm -f "$arquivo"
    echo "DIFERENTE: o arquivo baixado não bate com o checksum oficial; apaguei e não abri."
    return 1
  fi
}
