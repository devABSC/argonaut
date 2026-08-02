#!/bin/zsh
# Updates the Supabase database password everywhere it is needed:
#   .env               -> port 5432 (session mode), used locally and by prisma db push
#   .env.vercel-value  -> port 6543 (transaction mode), what Vercel needs
#   Vercel DATABASE_URL -> replaced from that file
# Prompts silently; the password never appears on screen or in shell history.
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.local/node/bin:$PATH"

REF=xeyyjbieqqyodifiyxxe
HOST=aws-0-ap-southeast-1.pooler.supabase.com

printf 'New Supabase database password: '
read -rs PW
echo
[ -n "$PW" ] || { echo "empty password, aborting"; exit 1; }
echo "  received ${#PW} characters — compare that against what Supabase showed you"
case "$PW" in
  *[[:space:]]*) echo "  WARNING: contains a space or newline — likely a bad paste" ;;
  \[*\])         echo "  WARNING: wrapped in [ ] — paste the password without brackets" ;;
esac

# Percent-encode anything that would break the connection URL.
ENC=$(python3 -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$PW")

LOCAL="postgresql://postgres.$REF:$ENC@$HOST:5432/postgres"
VERCEL="postgresql://postgres.$REF:$ENC@$HOST:6543/postgres?pgbouncer=true&connection_limit=1"

# 1. local .env
{
  echo '# Argonaut — LOCAL SECRETS. Gitignored. NEVER commit or paste in chat.'
  echo "DATABASE_URL=\"$LOCAL\""
} > .env
echo "✓ .env updated (5432 session mode)"

# 2. value for Vercel, no trailing newline
printf '%s' "$VERCEL" > .env.vercel-value
echo "✓ .env.vercel-value written (6543 transaction mode)"

# 3. prove the new credential actually works before pushing it anywhere.
# Retries: Supabase takes a little while to propagate a reset to the pooler.
node -e '
const {PrismaClient}=require("@prisma/client");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function why(e){
  const t=String(e.message||e);
  if(/Authentication failed/i.test(t)) return "WRONG PASSWORD (server rejected the credentials)";
  if(/reach database server/i.test(t)) return "CANNOT REACH SERVER (network/host/port)";
  if(/does not exist/i.test(t))        return "DATABASE OR ROLE DOES NOT EXIST (username wrong)";
  const l=t.split("\n").map(s=>s.trim()).filter(Boolean).find(s=>/^error:|failed|denied|timeout/i.test(s));
  return l || t.split("\n").filter(s=>s.trim())[1] || t.slice(0,120);
}
(async()=>{
  for(let i=1;i<=4;i++){
    const p=new PrismaClient();
    try{ await p.$queryRaw`SELECT 1`; console.log("✓ new password authenticates"); process.exit(0); }
    catch(e){
      const reason=why(e);
      if(i===4){ console.log("✗ new password REJECTED —",reason); process.exit(1); }
      console.log(`  attempt ${i}/4 failed (${reason}) — retrying in 8s…`);
      await sleep(8000);
    } finally { await p.$disconnect().catch(()=>{}); }
  }
})();
' || { echo "Stopping — Vercel was NOT touched, and .env now holds this password."; exit 1; }

# 4. replace it on Vercel
npx vercel env rm DATABASE_URL --yes >/dev/null 2>&1 || true
npx vercel env add DATABASE_URL production < .env.vercel-value >/dev/null 2>&1
npx vercel env add DATABASE_URL preview   < .env.vercel-value >/dev/null 2>&1
echo "✓ Vercel DATABASE_URL replaced (production + preview)"

echo
echo "Done. Tell Claude to deploy and verify."
