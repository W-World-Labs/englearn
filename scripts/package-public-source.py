#!/usr/bin/env python3
"""Package exact committed application source, not installed/runtime output."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tarfile

root = Path(__file__).resolve().parents[1]
output = Path(os.environ["RUNNER_TEMP"]) / "englearn-source"
output.mkdir()
commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
tracked = {name for name in subprocess.check_output(["git", "ls-files", "-z"], cwd=root, text=True).split("\0") if name}
assert not any(set(Path(name).parts) & {".gitea", ".hive", ".beads", ".swarm", "node_modules", ".output", ".env.local", ".npmrc"} for name in tracked)
manifest = json.loads((root / "public-files.json").read_text())
assert len(manifest["files"]) == len({entry["path"] for entry in manifest["files"]})
assert {entry["path"] for entry in manifest["files"]} == tracked - {"public-files.json"}
for entry in manifest["files"]:
    data = (root / entry["path"]).read_bytes()
    assert len(data) == entry["bytes"] and hashlib.sha256(data).hexdigest() == entry["sha256"], entry["path"]
archive = output / "englearn-source.tar.gz"
subprocess.run(["git", "archive", "--format=tar.gz", "--prefix=englearn/", "-o", str(archive), commit], cwd=root, check=True)
seen = set()
with tarfile.open(archive) as bundle:
    for member in bundle:
        assert member.isfile() or member.isdir()
        if member.isfile():
            name = member.name.removeprefix("englearn/")
            assert name in tracked and bundle.extractfile(member).read() == (root / name).read_bytes(), name
            seen.add(name)
assert seen == tracked and {"LICENSE", "NOTICE.md", "PUBLIC_SOURCE.md"} <= seen
(output / "SOURCE.json").write_text(json.dumps({"schema": 1, "commit": commit, "files": len(tracked), "scope": "application source and separately attributed assets; no installed dependency or production acceptance"}, sort_keys=True) + "\n")
subprocess.run(["npm", "ls", "--all", "--json"], cwd=root, stdout=(output / "DEPENDENCIES.json").open("w"), check=True)
(output / "SHA256SUMS").write_text("".join(hashlib.sha256(path.read_bytes()).hexdigest() + "  " + path.name + "\n" for path in sorted(output.iterdir())))
print("Verified exact committed source package and license/notice files")
