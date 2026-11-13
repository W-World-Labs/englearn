import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

it.each(["candidate", "old"])("only accepts the intended release (reported: %s), restoring the unit on failure", reported => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "englearn-deploy-"));
  try {
    const cache = path.join(root, "root/.cache/englearn-deploy");
    const releases = path.join(root, "opt/englearn/releases");
    const unit = path.join(root, "etc/systemd/system/englearn.service");
    fs.mkdirSync(cache, { recursive: true });
    fs.mkdirSync(path.join(releases, "old"), { recursive: true });
    fs.mkdirSync(path.dirname(unit), { recursive: true });
    fs.writeFileSync(unit, "previous unit");
    fs.writeFileSync(path.join(cache, "englearn.service"), "candidate unit");
    fs.symlinkSync(path.join(releases, "old"), path.join(root, "opt/englearn/current"));
    const payload = path.join(root, "payload");
    fs.mkdirSync(payload);
    fs.writeFileSync(path.join(payload, "index.mjs"), "// candidate");
    const archive = path.join(cache, "release.tar.gz");
    expect(spawnSync("tar", ["-czf", archive, "-C", payload, "."]).status).toBe(0);
    const sha = createHash("sha256").update(fs.readFileSync(archive)).digest("hex");
    const script = fs.readFileSync(new URL("./deploy-baseline.sh", import.meta.url), "utf8");
    let remote = script.split("<<'REMOTE'\n")[1].split("\nREMOTE")[0];
    remote = remote.replaceAll("/opt/englearn/runtime/node/bin/node", process.execPath);
    for (const prefix of ["/root/.cache/englearn-deploy", "/opt/englearn", "/etc/systemd/system", "/var/lib/englearn", "/var/backups/englearn"]) {
      remote = remote.replaceAll(prefix, `${root}${prefix}`);
    }
    // Exercise the actual release/rollback logic without touching services or the network.
    const mocks = `systemctl() { return 0; }\nchown() { return 0; }\nsleep() { return 0; }\ncurl() { printf '%s' '{"ok":true,"service":"englearn","release":"${reported}"}'; }\n`;
    const result = spawnSync("bash", ["-s", "--", "candidate", sha], { input: mocks + remote, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(reported === "candidate" ? 0 : 1);
    expect(fs.realpathSync(path.join(root, "opt/englearn/current"))).toBe(path.join(releases, reported === "candidate" ? "candidate" : "old"));
    expect(fs.readFileSync(unit, "utf8")).toBe(reported === "candidate" ? "candidate unit" : "previous unit");
    expect(fs.existsSync(path.join(root, "opt/englearn/deployed-release"))).toBe(reported === "candidate");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
