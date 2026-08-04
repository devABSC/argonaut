#!/usr/bin/env bash
# Is production up? Answers in one line. Safe to run any time.
set -uo pipefail
DOMAIN="${1:-argonaut.znergee.com}"
ROUTES=(/login / /home/overview /hris/employees /finance/soa /inventory/item-master /project/projects /settings/cron-jobs)
BAD=0
for r in "${ROUTES[@]}"; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 "https://$DOMAIN$r?cb=$RANDOM")
  case "$CODE" in
    200|307|308) printf "  \033[32m✓\033[0m %s  %s\n" "$CODE" "$r" ;;
    *)           printf "  \033[31m✗\033[0m %s  %s\n" "$CODE" "$r"; BAD=$((BAD+1)) ;;
  esac
done
if [ $BAD -eq 0 ]; then printf "\033[32m%s is up\033[0m\n" "$DOMAIN"; else printf "\033[31m%s: %d route(s) DOWN\033[0m\n" "$DOMAIN" "$BAD"; exit 1; fi
