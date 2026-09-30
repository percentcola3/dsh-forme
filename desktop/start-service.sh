#!/bin/zsh
set -eu
export NVM_DIR="$HOME/.nvm"
if [[ ! -f "$NVM_DIR/nvm.sh" ]]; then
  echo '{"phase":"error","message":"未找到 nvm，请安装 Node 22.22.0 后重试。"}'
  exit 1
fi
. "$NVM_DIR/nvm.sh"
if ! nvm use 22.22.0 >/dev/null 2>&1; then
  echo '{"phase":"error","message":"未找到 Node 22.22.0，请安装后重试。"}'
  exit 1
fi
export PNPM_HOME="$HOME/Library/pnpm"
export PATH="$PNPM_HOME:$PATH"
exec node "$1"
