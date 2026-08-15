#!/usr/bin/env bash
# Pull the latest code and restart the nation.
#
#   sudo /srv/memeostan/deploy/update.sh
#
# Deliberately refuses to restart into a build that didn't succeed: a failed
# `next build` leaves .next half-written, and restarting onto that serves a
# broken country rather than an old one.

set -euo pipefail

APP_DIR=/srv/memeostan
APP_USER=memeostan
SERVICE=memeostan

run_as_app() { sudo -u "$APP_USER" HOME="$APP_DIR" "$@"; }

cd "$APP_DIR"

echo "==> current: $(run_as_app git log --oneline -1 2>/dev/null || echo 'no git history')"

echo "==> fetching"
run_as_app git fetch --quiet origin main

if [ -z "$(run_as_app git log --oneline HEAD..origin/main)" ]; then
  echo "==> already up to date; nothing to do"
  exit 0
fi

echo "==> incoming:"
run_as_app git log --oneline HEAD..origin/main | sed 's/^/      /'

# Tracked files are reset to match the remote. Untracked files are left alone,
# which is what keeps .env.production, node_modules and .next in place.
echo "==> updating working tree"
run_as_app git reset --hard --quiet origin/main

echo "==> installing dependencies"
run_as_app npm ci --silent --no-audit --no-fund

echo "==> building"
if ! run_as_app npx next build; then
  echo
  echo "!!! BUILD FAILED — not restarting. The old process is still serving."
  echo "!!! Fix the build, then run this again."
  exit 1
fi

echo "==> restarting"
systemctl restart "$SERVICE"
sleep 6

if ! systemctl is-active --quiet "$SERVICE"; then
  echo "!!! service did not come back up:"
  journalctl -u "$SERVICE" -n 30 --no-pager -o cat
  exit 1
fi

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:3000/api/state || echo 000)
echo "==> service: $(systemctl is-active "$SERVICE") | /api/state -> $code"
echo "==> now at: $(run_as_app git log --oneline -1)"

if [ "$code" != "200" ]; then
  echo "!!! the app is up but not answering properly — check: journalctl -u $SERVICE -n 50"
  exit 1
fi

echo "==> done"
