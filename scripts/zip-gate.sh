#!/usr/bin/env bash
#
# Gate do zip do template linkbio.
#
# Uso: bash scripts/zip-gate.sh <dir>
#
# <dir> é o conteúdo do zip extraído (ou a raiz do repo, em verificação local).
# Sai com exit 1 e mensagem em PT-BR se encontrar no conteúdo:
#   - link de WhatsApp com número real (qualquer wa.me/ com dígitos
#     diferentes do número fictício 5511987654321);
#   - a marca do autor fora do README.md de créditos;
#   - nome de pessoa real;
#   - arquivo .env sem .example;
#   - diretórios .context/, mockups/ ou analise/ (dados do onboarding);
#   - trechos com cara de chave (sk-, eyJ, sb_secret_, token da Apify).
#
# NOTA: os padrões abaixo são montados por concatenação de propósito.
# Este script viaja dentro do conteúdo verificado, então os literais
# não podem aparecer no próprio fonte.
set -euo pipefail

DIR="${1:-}"
DIR="${DIR%/}"
if [ -z "$DIR" ] || [ ! -d "$DIR" ]; then
  echo "ERRO: informe o diretório a verificar. Uso: bash scripts/zip-gate.sh <dir>"
  exit 2
fi

FALHAS=0
falhou() { echo "GATE FALHOU: $1"; FALHAS=$((FALHAS + 1)); }

PAD_MARCA="vam""oo"
PAD_PESSOA="cast""ro"
# Chave com formato de verdade: "sk-" solto (não no meio de palavra, como em
# mask-image) seguido de 16+ caracteres; ou token JWT (cabeçalho base64 + ponto).
PAD_CHAVE_A='(^|[^A-Za-z0-9])s''k-[A-Za-z0-9_-]{16,}'
PAD_CHAVE_B='e''yJ[A-Za-z0-9_-]{10,}\.'
PAD_CHAVE_C='s''b_(secret|publishable)_[A-Za-z0-9_-]{16,}'
PAD_CHAVE_D='a''pify_api_[A-Za-z0-9]{16,}'

NUM_FICTICIO="5511987654321"

EXCLUIR=(--exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.next)

echo "Gate do zip: verificando ${DIR} ..."

# 1. WhatsApp com número real -------------------------------------------
# Só o número fictício pode aparecer em link wa.me/ ou parâmetro phone=.
TMP_OC=$(mktemp)
grep "${EXCLUIR[@]}" -rnIoE -i '(wa\.me/|phone=)[0-9][0-9+(). /-]*' "$DIR" > "$TMP_OC" 2>/dev/null || true
while IFS= read -r oc; do
  [ -z "$oc" ] && continue
  arquivo="${oc%%:*}"
  digitos=$(printf '%s' "${oc##*:}" | tr -cd '0-9')
  case "$digitos" in
    "$NUM_FICTICIO") ;;
    55*) falhou "número de WhatsApp real em ${arquivo} (só o fictício ${NUM_FICTICIO} pode ir no zip)" ;;
    *) falhou "link de WhatsApp suspeito em ${arquivo} (use o fictício ${NUM_FICTICIO} ou remova)" ;;
  esac
done < "$TMP_OC"
rm -f "$TMP_OC"

# O número mora solto na config (contact.whatsapp) e o link só nasce em runtime:
# qualquer 55 + DDD + número (12–13 dígitos) que não seja o fictício também reprova.
# Também pega celular escrito à mão, com ou sem 55: "+55 (47) 9xxxx-xxxx", "(47) 9xxxx xxxx", "479xxxxxxxx".
PAD_TEL_COLADO='(^|[^0-9])55[0-9]{10,11}([^0-9]|$)'
PAD_TEL_CELULAR='(^|[^0-9])(\+?55[ .-]*)?\(?[1-9][0-9]\)?[ .-]*9[0-9]{4}[ .-]?[0-9]{4}([^0-9]|$)'
TMP_NUM=$(mktemp)
grep "${EXCLUIR[@]}" --exclude=package-lock.json -rnIoE -e "$PAD_TEL_COLADO" -e "$PAD_TEL_CELULAR" "$DIR" > "$TMP_NUM" 2>/dev/null || true
while IFS= read -r oc; do
  [ -z "$oc" ] && continue
  arquivo="${oc%%:*}"
  digitos=$(printf '%s' "${oc#*:*:}" | tr -cd '0-9')
  # Sem o 55 (DDD + 9 dígitos): completa para comparar com o fictício.
  [ "${#digitos}" -eq 11 ] && digitos="55${digitos}"
  # Teste que precisa de outro formato (fixo, DDD 55, internacional) marca a linha com "ficticio".
  resto="${oc#*:}"; linha="${resto%%:*}"
  sed -n "${linha}p" "$arquivo" | grep -q "ficticio" && continue
  [ "$digitos" = "$NUM_FICTICIO" ] || falhou "número de telefone real em ${arquivo} (só o fictício ${NUM_FICTICIO} pode ir no zip)"
done < "$TMP_NUM"
rm -f "$TMP_NUM"

# 2. Marca do autor fora do README de créditos ---------------------------
# A marca só pode aparecer no README.md (créditos). Todo o resto reprova.
TMP_MARCA=$(mktemp)
grep "${EXCLUIR[@]}" -rli "$PAD_MARCA" "$DIR" > "$TMP_MARCA" 2>/dev/null || true
# Só o README.md da raiz é de créditos; um docs/README.md com a marca reprova.
FORA_LEI=$(grep -vx "${DIR}/README\.md" "$TMP_MARCA" || true)
if [ -n "$FORA_LEI" ]; then
  falhou "marca '${PAD_MARCA}' fora do README.md de créditos em: $(printf '%s' "$FORA_LEI" | tr '\n' ' ')(a marca só pode aparecer no README.md)"
fi
rm -f "$TMP_MARCA"

# 3. Nome de pessoa real --------------------------------------------------
TMP_PESSOA=$(mktemp)
grep "${EXCLUIR[@]}" -rnIi "$PAD_PESSOA" "$DIR" > "$TMP_PESSOA" 2>/dev/null || true
if [ -s "$TMP_PESSOA" ]; then
  falhou "nome de pessoa real ('${PAD_PESSOA}') encontrado em: $(cut -d: -f1 "$TMP_PESSOA" | sort -u | tr '\n' ' ')"
fi
rm -f "$TMP_PESSOA"

# 4. Arquivo .env sem .example -------------------------------------------
TMP_ENV=$(mktemp)
find "$DIR" \( -path '*/.git/*' -o -path '*/node_modules/*' -o -path '*/.next/*' \) -prune -o -type f -name '.env*' ! -name '.env.example' -print > "$TMP_ENV" 2>/dev/null || true
if [ -s "$TMP_ENV" ]; then
  falhou "arquivo de ambiente real no zip (só .env.example pode ir): $(tr '\n' ' ' < "$TMP_ENV")"
fi
rm -f "$TMP_ENV"

# 5. Diretórios internos --------------------------------------------------
TMP_DIRS=$(mktemp)
find "$DIR" \( -path '*/.git/*' -o -path '*/node_modules/*' -o -path '*/.next/*' \) -prune -o -type d \( -name '.context' -o -name 'mockups' -o -name 'analise' \) -print > "$TMP_DIRS" 2>/dev/null || true
if [ -s "$TMP_DIRS" ]; then
  falhou "diretório interno no zip (não distribuir): $(tr '\n' ' ' < "$TMP_DIRS")"
fi
rm -f "$TMP_DIRS"

# 6. Trechos com cara de chave --------------------------------------------
# package-lock.json e o próprio gate geram falsos positivos (hashes base64,
# padrões montados por concatenação): ficam fora da varredura.
TMP_CHAVES=$(mktemp)
grep "${EXCLUIR[@]}" --exclude=package-lock.json --exclude=zip-gate.sh -rnIE -e "$PAD_CHAVE_A" -e "$PAD_CHAVE_B" -e "$PAD_CHAVE_C" -e "$PAD_CHAVE_D" "$DIR" > "$TMP_CHAVES" 2>/dev/null || true
if [ -s "$TMP_CHAVES" ]; then
  falhou "trecho com cara de chave encontrado em: $(cut -d: -f1 "$TMP_CHAVES" | sort -u | tr '\n' ' ')(remova segredos do zip)"
fi
rm -f "$TMP_CHAVES"

# 7. Token da Apify no formato antigo (sem prefixo) escrito numa variável -----
# Só a linha vazia "APIFY_TOKEN=" pode ir (no .env.example).
TMP_APIFY=$(mktemp)
grep "${EXCLUIR[@]}" --exclude=zip-gate.sh -rnIE 'A''PIFY_TOKEN=[A-Za-z0-9_-]{20,}' "$DIR" > "$TMP_APIFY" 2>/dev/null || true
if [ -s "$TMP_APIFY" ]; then
  falhou "token da Apify preenchido em: $(cut -d: -f1 "$TMP_APIFY" | sort -u | tr '\n' ' ')(deixe só 'APIFY_TOKEN=' vazio)"
fi
rm -f "$TMP_APIFY"

if [ "$FALHAS" -ne 0 ]; then
  echo "Gate do zip: REPROVADO com ${FALHAS} problema(s)."
  exit 1
fi
echo "Gate do zip: APROVADO."
