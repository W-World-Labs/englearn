#!/usr/bin/env bash
# Publish an immutable build to the operator-selected LingoLearn runtime.
# Supply your own mode-0600 /etc/englearn/runtime.env first.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
TARGET="${ENGLEARN_DEPLOY_TARGET:?Set your explicit deployment target}"
RELEASE="$(git rev-parse --short=12 HEAD)"
if [[ -n "$(git status --porcelain)" ]]; then
  echo '[deploy] Commit the reviewed release before publishing.' >&2
  exit 1
fi
if [[ "${ENGLEARN_SKIP_GATES:-0}" != '1' ]]; then
  npm run typecheck
  npm test
fi
VITE_ENGLEARN_RELEASE="$RELEASE" W_RADAR_SDK_CODE="${W_RADAR_SDK_CODE:-}" npm run build
ARCHIVE="$(mktemp /tmp/englearn-release-XXXXXX.tar.gz)"
trap 'rm -f "$ARCHIVE"' EXIT
tar -C .output -czf "$ARCHIVE" .
SHA="$(sha256sum "$ARCHIVE" | cut -d ' ' -f 1)"
ssh -o BatchMode=yes -o ConnectTimeout=10 "$TARGET" "install -d -m 700 /root/.cache/englearn-deploy && test -s /etc/englearn/runtime.env && test -x /opt/englearn/runtime/node/bin/node"
scp -q "$ARCHIVE" "$TARGET:/root/.cache/englearn-deploy/release.tar.gz"
scp -q deploy/baseline/englearn.service "$TARGET:/root/.cache/englearn-deploy/englearn.service"
ssh -o BatchMode=yes -o ConnectTimeout=10 "$TARGET" bash -s -- "$RELEASE" "$SHA" <<'REMOTE'
set -Eeuo pipefail
release="$1"
expected="$2"
archive=/root/.cache/englearn-deploy/release.tar.gz
actual="$(sha256sum "$archive" | cut -d ' ' -f 1)"
[[ "$actual" == "$expected" ]]
target="/opt/englearn/releases/$release"
[[ ! -e "$target" ]] || { echo 'Release already exists; use its recorded rollback path.' >&2; exit 1; }
install -d -m 755 "$target"
tar -xzf "$archive" -C "$target"
chown -R root:root "$target"
chmod -R go-w "$target"
previous="$(readlink -f /opt/englearn/current || true)"
unit=/etc/systemd/system/englearn.service
unit_backup=/root/.cache/englearn-deploy/englearn.service.previous
had_unit=0
if [[ -f "$unit" ]]; then
  cp -p "$unit" "$unit_backup"
  had_unit=1
fi
if [[ -d /var/lib/englearn ]]; then
  install -d -m 700 /var/backups/englearn
  tar -C /var/lib -czf "/var/backups/englearn/before-$release-$(date -u +%Y%m%dT%H%M%SZ).tar.gz" englearn
fi
rollback() {
  trap - ERR
  if [[ "$had_unit" == 1 ]]; then
    cp -p "$unit_backup" "$unit"
  else
    rm -f "$unit"
  fi
  systemctl daemon-reload
  if [[ -n "$previous" && -d "$previous" ]]; then
    ln -sfn "$previous" /opt/englearn/current.next
    mv -Tf /opt/englearn/current.next /opt/englearn/current
    systemctl restart englearn.service
  else
    systemctl stop englearn.service || true
  fi
}
trap rollback ERR
install -m 644 /root/.cache/englearn-deploy/englearn.service /etc/systemd/system/englearn.service
ln -sfn "$target" /opt/englearn/current.next
mv -Tf /opt/englearn/current.next /opt/englearn/current
systemctl daemon-reload
systemctl enable englearn.service
systemctl restart englearn.service
check_release() {
  curl --fail --silent --show-error --max-time 5 http://127.0.0.1:3010/api/health |
    /opt/englearn/runtime/node/bin/node --input-type=module -e '
      let raw = "";
      for await (const chunk of process.stdin) raw += chunk;
      const health = JSON.parse(raw);
      if (health.ok !== true || health.service !== "englearn" || health.release !== process.argv[1]) process.exit(1);
    ' "$release"
}
healthy=0
for attempt in 1 2 3; do
  if check_release; then healthy=1; break; fi
  if [[ "$attempt" != 3 ]]; then sleep 1; fi
done
[[ "$healthy" == 1 ]]
printf '%s\n' "$release" > /opt/englearn/deployed-release
printf '[deploy] Started release %s; archive SHA256 %s\n' "$release" "$expected"
REMOTE
printf '[deploy] Verify public HTTPS, W-ID callback and account records before marking the registry active.\n'
