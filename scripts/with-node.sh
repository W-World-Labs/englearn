#!/usr/bin/env bash
# 启动前必须已安装 Node.js；随后执行 ensure-ready，再运行传入的命令。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MIN_MAJOR=22
MIN_MINOR=12

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "[englearn] 错误：未检测到 Node.js，无法启动。"
  echo ""
  echo "  请先安装 Node.js 22 LTS（推荐）："
  echo "    https://nodejs.org/"
  echo ""
  echo "  或使用版本管理器："
  echo "    nvm:  nvm install 22 && nvm use 22"
  echo "    fnm:  fnm install 22 && fnm use 22"
  echo ""
  echo "  安装后执行: node -v   # 应显示 v22.12+"
  echo "  然后执行:   npm run dev"
  echo ""
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[englearn] 错误：未检测到 npm（通常随 Node.js 一起安装）。"
  exit 1
fi

node -e "
const [maj, min] = process.versions.node.split('.').map(Number);
const ok = maj > ${MIN_MAJOR} || (maj === ${MIN_MAJOR} && min >= ${MIN_MINOR});
if (!ok) {
  console.error('[englearn] 错误：Node.js 版本过低（当前 v' + process.versions.node + '）');
  console.error('  需要 Node.js >= ${MIN_MAJOR}.${MIN_MINOR}.0（推荐 22 LTS）');
  process.exit(1);
}
"

node scripts/ensure-ready.mjs

if [ $# -eq 0 ]; then
  exit 0
fi

exec "$@"