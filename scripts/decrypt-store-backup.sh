#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <input.store-backup.enc> <output.store-backup.dec.json>" >&2
  exit 2
fi

input=$1
output=$2
[[ -f "$input" ]] || { echo "Encrypted backup not found: $input" >&2; exit 1; }
[[ ! -e "$output" ]] || { echo "Refusing to overwrite: $output" >&2; exit 1; }

if [[ -f "${input}.sha256" ]]; then
  shasum -a 256 -c "${input}.sha256"
fi
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in "$input" -out "$output"
echo "Decrypted backup: $output"
echo "Delete the plaintext file immediately after restore."
