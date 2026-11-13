#!/usr/bin/env node
/** Native, dependency-free regression test for the root document Radar loader. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(path.join(root, "src/app/__root.tsx"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Source-level guard: the root document must have one loader path only.
assert(!source.includes('src: "https://radar.myfastools.com/sdk.js"'),
  "root must not load the standalone SDK");
assert(source.includes("src: RADAR_BOOTSTRAP"),
  "root must load the platform bootstrap");
assert(source.includes('"data-workspace-id": RADAR_WORKSPACE'),
  "workspace binding is missing");
assert(source.includes('"data-project-id": RADAR_PROJECT'),
  "project binding is missing");
assert(source.includes('"data-code": RADAR_SDK'),
  "configured Radar code must be passed to bootstrap");

// Execute the actual config and scripts expression, including default-off policy.
const configMatch = source.match(/const RADAR_SDK = .*?(?=\nfunction DocumentLocale)/s);
assert(configMatch, "root Radar configuration is missing");
const scriptsMatch = source.match(/scripts:\s*\[(.*?)\n\s*\],/s);
assert(scriptsMatch, "root scripts array is missing");
// Literal type assertions do not change the emitted script values.
const scriptsExpression = `[${scriptsMatch[1].replaceAll(" as const", "")}\n]`;

function renderScripts(env) {
  return vm.runInNewContext(`${configMatch[0]}\n(${scriptsExpression})`, {
    process: { env },
    URL,
  });
}

const configured = {
  W_RADAR_BOOTSTRAP_URL: "https://telemetry.example.test/platform/bootstrap.js",
  W_RADAR_SDK_CODE: "W-LINGOLEARN-TEST",
  W_RADAR_WORKSPACE_ID: "workspace-test",
  W_RADAR_PROJECT_ID: "project-test",
};
for (const [label, env] of [
  ["unset", {}],
  ...Object.keys(configured).map((key) => [`missing ${key}`, { ...configured, [key]: "" }]),
  ["insecure URL", { ...configured, W_RADAR_BOOTSTRAP_URL: "http://telemetry.example.test/bootstrap.js" }],
  ["credential URL", { ...configured, W_RADAR_BOOTSTRAP_URL: "https://user:secret@telemetry.example.test/bootstrap.js" }],
  ["invalid URL", { ...configured, W_RADAR_BOOTSTRAP_URL: "invalid" }],
]) {
  assert(renderScripts(env).length === 0, `${label}: external Radar loader must be disabled`);
}

for (const [label, env] of [["configured", configured]]) {
  const code = env.W_RADAR_SDK_CODE;
  const scripts = renderScripts(env);
  assert(scripts.length === 1, `${label}: expected one Radar loader`);
  assert(scripts[0].src.endsWith("/platform/bootstrap.js"),
    `${label}: expected platform bootstrap URL`);
  assert(scripts[0]["data-workspace-id"] === env.W_RADAR_WORKSPACE_ID,
    `${label}: workspace binding changed`);
  assert(scripts[0]["data-project-id"] === env.W_RADAR_PROJECT_ID,
    `${label}: project binding changed`);
  assert(("data-code" in scripts[0]) === Boolean(code),
    `${label}: data-code presence does not match configuration`);
  assert(scripts[0]["data-code"] === code,
    `${label}: configured Radar code changed`);
  assert(scripts[0].crossOrigin === "anonymous" && scripts[0].referrerPolicy === "no-referrer",
    `${label}: external loader must not send cross-origin credentials or referrer`);
  assert(scripts[0]["data-capture-network"] === "false" &&
    scripts[0]["data-capture-global-errors"] === "false" &&
    scripts[0]["data-allow-url-query"] === "false",
    `${label}: automatic diagnostic capture must remain disabled`);
}

console.log("Radar bootstrap tests passed (source + unset/configured render cases)");
