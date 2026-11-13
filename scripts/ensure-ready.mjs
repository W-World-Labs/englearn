#!/usr/bin/env node
/**
 * Runs before dev/start: install deps if missing, seed .env.local, ensure data dir.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  statSync,
} from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const MIN_NODE = [22, 12, 0];
const [maj, min, patch] = process.versions.node.split(".").map(Number);
const nodeOk =
  maj > MIN_NODE[0] ||
  (maj === MIN_NODE[0] && min > MIN_NODE[1]) ||
  (maj === MIN_NODE[0] && min === MIN_NODE[1] && patch >= MIN_NODE[2]);
if (!nodeOk) {
  console.error(
    `[englearn] Node.js 版本过低（当前 v${process.versions.node}，需要 >= ${MIN_NODE.join(".")}）`
  );
  process.exit(1);
}

function run(cmd) {
  execSync(cmd, { cwd: root, stdio: "inherit" });
}

const nodeModules = path.join(root, "node_modules");
if (!existsSync(nodeModules)) {
  console.log("[englearn] node_modules 不存在，正在执行 npm install …");
  run("npm install");
} else {
  const lock = path.join(root, "package-lock.json");
  const nmPkg = path.join(nodeModules, ".package-lock.json");
  if (existsSync(lock) && existsSync(nmPkg)) {
    try {
      if (statSync(lock).mtimeMs > statSync(nmPkg).mtimeMs) {
        console.log("[englearn] 依赖可能已过期，正在执行 npm install …");
        run("npm install");
      }
    } catch {
      /* ignore stat errors */
    }
  }
}

const envLocal = path.join(root, ".env.local");
const envExample = path.join(root, ".env.example");
if (!existsSync(envLocal) && existsSync(envExample)) {
  copyFileSync(envExample, envLocal);
  console.log("[englearn] 已从 .env.example 创建 .env.local（可按需填写 API Key）");
}

const dataDir = path.join(root, "data");
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const lifecycle = process.env.npm_lifecycle_event ?? "";
console.log(`[englearn] Node.js v${process.versions.node}`);
if (lifecycle === "setup") {
  console.log("[englearn] 环境就绪。");
} else {
  console.log("[englearn] 环境就绪，正在启动 …");
}