#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=${CTB_WEB_PREVIEW_ENV:-"$HOME/.config/codex-telegram-bridge/web-preview.env"}
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: env file not found: $ENV_FILE" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a
: "${CTB_WEB_READONLY_PORT:=45682}"
: "${PROXY_PORT:=45683}"
PASS=${CTB_WEB_PREVIEW_PASS:-${CTB_WEB_BASIC_PASS:-}}
if [[ -z "${PASS}" || -z "${CTB_WEB_READONLY_TOKEN:-}" || -z "${CTB_WEB_SESSION_SECRET:-}" ]]; then
  echo "ERROR: missing password, bearer token, or session secret in $ENV_FILE" >&2
  exit 1
fi
BASE="http://127.0.0.1:${PROXY_PORT}"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

curl_code() {
  local out=$1; shift
  curl -sS --max-time 10 -o "$out" -w '%{http_code}' "$@"
}

expect_code() {
  local expected=$1 actual=$2 label=$3
  if [[ "$actual" != "$expected" ]]; then
    echo "ERROR: $label returned HTTP $actual, expected $expected" >&2
    exit 1
  fi
  echo "ok: $label HTTP $actual"
}

leak_check() {
  local label=$1; shift
  local file
  for file in "$@"; do
    [[ -f "$file" ]] || continue
    for secret in "$CTB_WEB_READONLY_TOKEN" "$CTB_WEB_SESSION_SECRET" "$PASS"; do
      if [[ -n "$secret" ]] && grep -Fq "$secret" "$file"; then
        echo "ERROR: secret leaked in $label" >&2
        exit 1
      fi
    done
  done
}

code=$(curl_code "$TMP_DIR/healthz.body" "$BASE/healthz")
expect_code 200 "$code" "proxy /healthz"
grep -q '"ok":true' "$TMP_DIR/healthz.body" || { echo "ERROR: /healthz is not machine-checkable" >&2; exit 1; }
leak_check healthz "$TMP_DIR/healthz.body"

code=$(curl_code "$TMP_DIR/login.body" "$BASE/owner-login")
expect_code 200 "$code" "GET /owner-login"
grep -q 'Owner preview login' "$TMP_DIR/login.body" || { echo "ERROR: login page marker missing" >&2; exit 1; }
leak_check login "$TMP_DIR/login.body"

code=$(curl_code "$TMP_DIR/unauth-root.body" "$BASE/")
expect_code 200 "$code" "unauthenticated /"
grep -q 'Owner preview login' "$TMP_DIR/unauth-root.body" || { echo "ERROR: unauthenticated root did not return login" >&2; exit 1; }
leak_check unauth-root "$TMP_DIR/unauth-root.body"

# Direct readonly app should not expose state without the bearer token.
direct_code=$(curl -sS --max-time 5 -o "$TMP_DIR/direct-readonly.body" -w '%{http_code}' "http://127.0.0.1:${CTB_WEB_READONLY_PORT}/" || true)
if [[ "$direct_code" == "200" ]]; then
  echo "ERROR: direct readonly app returned public 200 without bearer token" >&2
  exit 1
fi
echo "ok: direct readonly app unauthenticated HTTP $direct_code"
leak_check direct-readonly "$TMP_DIR/direct-readonly.body"

login_code=$(curl -sS --max-time 10 -D "$TMP_DIR/login.headers" -o "$TMP_DIR/login-post.body" -w '%{http_code}' \
  -X POST --data-urlencode "password=${PASS}" "$BASE/owner-login")
expect_code 303 "$login_code" "POST /owner-login"
COOKIE=$(grep -i '^Set-Cookie:' "$TMP_DIR/login.headers" | head -n1 | sed -E 's/^[Ss]et-[Cc]ookie:[[:space:]]*//; s/;.*$//')
if [[ -z "$COOKIE" || "$COOKIE" != ctb_web_owner=* ]]; then
  echo "ERROR: owner session cookie missing" >&2
  exit 1
fi
leak_check login-post "$TMP_DIR/login.headers" "$TMP_DIR/login-post.body"

home_code=$(curl_code "$TMP_DIR/home.body" -H "Cookie: $COOKIE" "$BASE/")
expect_code 200 "$home_code" "authenticated Home"
grep -q 'Codex Console' "$TMP_DIR/home.body" || { echo "ERROR: Home marker missing" >&2; exit 1; }
leak_check home "$TMP_DIR/home.body"

interactions_code=$(curl_code "$TMP_DIR/interactions.body" -H "Cookie: $COOKIE" "$BASE/interactions")
expect_code 200 "$interactions_code" "authenticated /interactions"
grep -Eq 'Pending/Approvals|Pending interactions|Codex Console' "$TMP_DIR/interactions.body" || { echo "ERROR: interactions marker missing" >&2; exit 1; }
leak_check interactions "$TMP_DIR/interactions.body"

DETAIL=$(grep -Eoh '/conversations/cv_[a-f0-9]{16}' "$TMP_DIR/home.body" "$TMP_DIR/interactions.body" | head -n1 || true)
if [[ -n "$DETAIL" ]]; then
  detail_code=$(curl_code "$TMP_DIR/detail.body" -H "Cookie: $COOKIE" "$BASE$DETAIL")
  expect_code 200 "$detail_code" "authenticated detail $DETAIL"
  leak_check detail "$TMP_DIR/detail.body"
else
  echo "ok: no conversation detail route discovered; skipped optional detail smoke"
fi

echo "Smoke passed for $BASE"
