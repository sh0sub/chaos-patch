#!/usr/bin/env bash

set -euo pipefail

if [[ ! -t 0 ]]; then
  echo "Run this script interactively from a terminal." >&2
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
target="${repo_root}/.env.local"
redirect_uri="http://localhost:3000/auth/callback"

existing_openai_key=""
existing_session_secret=""
if [[ -f "${target}" ]]; then
  existing_openai_key="$(sed -n 's/^OPENAI_API_KEY=//p' "${target}" | tail -n 1)"
  existing_session_secret="$(sed -n 's/^SESSION_SECRET=//p' "${target}" | tail -n 1)"
fi

echo "Chaos Patch local credential setup"
echo "Values are written only to ${target}."
echo "Turn off screen sharing and recording before continuing."
echo

IFS= read -r -p "Twitch Client ID: " twitch_client_id
IFS= read -r -s -p "Twitch Client Secret (hidden): " twitch_client_secret
echo
IFS= read -r -s -p "OpenAI API key (optional, hidden; Enter to keep current): " openai_api_key
echo

if [[ -z "${twitch_client_id}" ]]; then
  echo "Twitch Client ID is required." >&2
  exit 1
fi

if [[ -z "${twitch_client_secret}" ]]; then
  echo "Twitch Client Secret is required." >&2
  exit 1
fi

if [[ -z "${openai_api_key}" ]]; then
  openai_api_key="${existing_openai_key}"
fi

if [[ -z "${existing_session_secret}" ]]; then
  existing_session_secret="$(openssl rand -hex 32)"
fi

umask 077
temp_file="$(mktemp "${TMPDIR:-/tmp}/chaos-patch-env.XXXXXX")"
trap 'rm -f "${temp_file}"' EXIT

{
  echo "# Local secrets only. This file is ignored by Git."
  printf 'TWITCH_CLIENT_ID=%s\n' "${twitch_client_id}"
  printf 'TWITCH_CLIENT_SECRET=%s\n' "${twitch_client_secret}"
  printf 'TWITCH_REDIRECT_URI=%s\n' "${redirect_uri}"
  echo
  echo "# Runtime API key. May remain empty until billing is ready."
  printf 'OPENAI_API_KEY=%s\n' "${openai_api_key}"
  echo 'OPENAI_MODEL=gpt-4o-mini'
  printf 'SESSION_SECRET=%s\n' "${existing_session_secret}"
} > "${temp_file}"

mv "${temp_file}" "${target}"
chmod 600 "${target}"
trap - EXIT

unset twitch_client_id twitch_client_secret openai_api_key existing_openai_key existing_session_secret

echo
echo "Saved credentials to .env.local with mode 600."
echo "No credential values were printed."
