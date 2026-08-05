#!/usr/bin/env bash
set -euo pipefail

paths=()
while (($#)); do
  case "$1" in
    --path) [[ $# -ge 2 ]] || { echo 'secret-scan: --path requires a directory' >&2; exit 2; }; paths+=("$2"); shift 2 ;;
    *) echo "secret-scan: unknown option $1" >&2; exit 2 ;;
  esac
done
((${#paths[@]})) || { echo 'secret-scan: provide at least one --path' >&2; exit 2; }

files=()
for path in "${paths[@]}"; do
  [[ -e "$path" ]] || { echo "secret-scan: missing path $path" >&2; exit 2; }
  while IFS= read -r -d '' file; do
    [[ "$file" == */docs/bdd/* ]] && continue
    files+=("$file")
  done < <(find "$path" -type f -print0)
done
((${#files[@]})) || exit 0

# Scan credential-shaped values; documented variable names and placeholders remain valid.
patterns=(
  'postgres(ql)?://[^[:space:]"`]+:[^[:space:]"`]+@'
  '(^|[^A-Za-z0-9_])(sk_live|sk_test|ghp_|github_pat_|xox[baprs]-)[A-Za-z0-9_-]{12,}'
  '(^|[^A-Za-z0-9_])ZEABUR_TOKEN[[:space:]]*=[[:space:]]*[^$<[{[:space:]]'
  '(^|[^A-Za-z0-9_])Authorization:[[:space:]]*Bearer[[:space:]]+[A-Za-z0-9._-]{12,}'
)
for pattern in "${patterns[@]}"; do
  if rg -n --no-messages --pcre2 "$pattern" "${files[@]}"; then
    echo 'secret-scan: credential-shaped value found' >&2
    exit 1
  fi
done
exit 0
