#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <input.store-backup.json> <output.store-backup.enc>" >&2
  exit 2
fi

input=$1
output=$2
[[ -f "$input" ]] || { echo "Input backup not found: $input" >&2; exit 1; }
[[ ! -e "$output" ]] || { echo "Refusing to overwrite: $output" >&2; exit 1; }

openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -in "$input" -out "$output"
shasum -a 256 "$output" > "${output}.sha256"
echo "Encrypted backup: $output"
echo "Checksum: ${output}.sha256"
