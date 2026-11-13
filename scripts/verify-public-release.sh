#!/usr/bin/env bash
# Verify the public edge after cutover; never accept an old or unhealthy release.
set -euo pipefail
release="${1:?Pass the deployed Git SHA}"
release="${release:0:12}"
[[ "$release" =~ ^[0-9a-f]{12}$ ]]
probe_dir="$(mktemp -d)"
trap 'rm -rf "$probe_dir"' EXIT

check() {
  local url="$1" kind="$2" code attempt suffix=""
  if [[ "$kind" == health ]]; then suffix=" release=$release"; fi
  for attempt in 1 2 3; do
    code=000
    if code="$(curl --silent --show-error --connect-timeout 5 --max-time 15 \
      --dump-header "$probe_dir/headers" --output "$probe_dir/body" \
      --write-out '%{http_code}' "$url")" && [[ "$code" == 200 ]]; then
      if [[ "$kind" == page ]] || node -e '
        try {
          const h = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
          if (h.ok !== true || h.service !== "englearn" || h.release !== process.argv[2]) process.exit(1);
        } catch { process.exit(1); }
      ' "$probe_dir/body" "$release"; then
        printf '[verify] %s HTTP 200%s\n' "$url" "$suffix"
        return 0
      fi
    fi
    printf '[verify] Attempt %s/3: %s HTTP %s; expected HTTP 200%s\n' \
      "$attempt" "$url" "$code" "$suffix" >&2
    # Keep edge diagnostics, never cookies or arbitrary response bodies.
    if [[ -f "$probe_dir/headers" ]]; then
      sed -n -E '/^([Ss]erver|[Cc][Ff]-[Rr]ay|[Cc][Ff]-[Mm]itigated|[Cc]ontent-[Tt]ype):/p' "$probe_dir/headers" >&2
    fi
    if [[ "$attempt" != 3 ]]; then sleep 2; fi
  done
  return 1
}

for host in ${ENGLEARN_PUBLIC_HOSTS:?Set space-separated public hostnames}; do
  check "https://$host/api/health" health
  for path in / /learn '/learn?tab=profile' '/learn?tab=week' /vocabulary /exams /ielts; do
    check "https://$host$path" page
  done
done
