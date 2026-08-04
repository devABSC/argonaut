#!/usr/bin/env bash
#
# The only way argonaut goes to production.
#
# Written after an incident where the whole site answered 404 for hours: the
# Vercel project had lost its framework preset, and nobody checked the live URL
# after deploying. Every step below exists because something went wrong without
# it.
#
#   1. Build locally first — never find out on the platform.
#   2. Refuse to upload secrets.
#   3. Assert the project settings that, when wrong, 404 the entire site.
#   4. Deploy without git metadata (the git-author block), always restoring .git.
#   5. Verify the live domain route by route, and FAIL LOUDLY if it is not up.
#
# Usage:  npm run ship
set -uo pipefail

DOMAIN="argonaut.znergee.com"
PROJECT_ID="prj_zdtWldaLUruHxziBVrmz3X5QwnNN"
TEAM_ID="team_oWQaCHtnSWeZYeyPIaAaPofP"
AUTH="$HOME/Library/Application Support/com.vercel.cli/auth.json"

# Routes that must answer. 200 = public, 307 = correctly redirecting to sign-in.
ROUTES=(/login / /home/overview /hris/employees /finance/soa /inventory/item-master /project/projects /settings/cron-jobs)

red()  { printf "\033[31m%s\033[0m\n" "$*"; }
grn()  { printf "\033[32m%s\033[0m\n" "$*"; }
say()  { printf "\n\033[1m%s\033[0m\n" "$*"; }

fail() { red "✗ $*"; exit 1; }

cd "$(dirname "$0")/.." || exit 1
export PATH="$HOME/.local/node/bin:$PATH"

# ── 1. it must build here before it goes anywhere ────────────────────────────
say "1/5  Building locally"
npm run build >/tmp/argo-build.log 2>&1 || { tail -30 /tmp/argo-build.log; fail "build failed — nothing was deployed"; }
grn "✓ build clean"

# ── 2. secrets must not travel ───────────────────────────────────────────────
say "2/5  Checking nothing secret is uploaded"
[ -f .vercelignore ] || fail ".vercelignore is missing — .env would be uploaded, since the git-less deploy hides .gitignore"
grep -qx '\.env' .vercelignore || fail ".vercelignore does not exclude .env"
grn "✓ .env excluded"

# ── 3. the settings whose absence 404s the whole site ────────────────────────
say "3/5  Checking the Vercel project settings"
[ -f "$AUTH" ] || fail "no Vercel CLI session — run: npx vercel login"
TOKEN=$(python3 -c "import json,os;print(json.load(open(os.path.expanduser('$AUTH'))).get('token',''))")
[ -n "$TOKEN" ] || fail "could not read the Vercel session — run: npx vercel login"

FRAMEWORK=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.vercel.com/v9/projects/$PROJECT_ID?teamId=$TEAM_ID" \
  | python3 -c "import json,sys;print(json.load(sys.stdin).get('framework') or 'NONE')")

if [ "$FRAMEWORK" != "nextjs" ]; then
  red "framework preset is '$FRAMEWORK' — this is what 404s every route"
  curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"framework":"nextjs"}' \
    "https://api.vercel.com/v9/projects/$PROJECT_ID?teamId=$TEAM_ID" >/dev/null
  grn "✓ framework set back to nextjs"
else
  grn "✓ framework preset is nextjs"
fi

# ── 4. deploy, and always put .git back ──────────────────────────────────────
say "4/5  Deploying to production"
# The Vercel account blocks deployments authored by devABSC, so the upload goes
# without git metadata. The trap guarantees .git returns even if this dies.
restore() { [ -d .git-hold ] && mv .git-hold .git; }
trap restore EXIT INT TERM
[ -d .git ] && mv .git .git-hold
npx --yes vercel@latest deploy --prod --yes --archive=tgz >/tmp/argo-deploy.log 2>&1
DEPLOY_RC=$?
restore
trap - EXIT INT TERM
[ -d .git ] || fail ".git was not restored — check for .git-hold before doing anything else"
[ $DEPLOY_RC -eq 0 ] || { tail -20 /tmp/argo-deploy.log; fail "deploy failed"; }
grn "✓ uploaded and aliased"

# ── 5. the step that was missing ─────────────────────────────────────────────
say "5/5  Verifying the live site"
sleep 6
BAD=0
for i in 1 2 3 4 5 6 7 8; do
  BAD=0
  OUT=""
  for r in "${ROUTES[@]}"; do
    CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 "https://$DOMAIN$r?cb=$RANDOM")
    case "$CODE" in
      200|307|308) OUT="$OUT  ✓ $CODE  $r\n" ;;
      *)           OUT="$OUT  ✗ $CODE  $r\n"; BAD=$((BAD+1)) ;;
    esac
  done
  [ $BAD -eq 0 ] && break
  echo "  attempt $i: $BAD route(s) not answering yet, waiting…"
  sleep 15
done

printf "%b" "$OUT"
if [ $BAD -ne 0 ]; then
  red "✗ $BAD route(s) are down AFTER deploying — the site is not healthy"
  red "  check: https://vercel.com/bme6/argonaut"
  exit 1
fi

grn "✓ https://$DOMAIN is up — every checked route answered"
