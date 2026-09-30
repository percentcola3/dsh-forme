# DeepSeekHarness App

Pake 3.16.1 外壳，使用本机 Node 22.22.0 运行 `npx --yes --prefer-offline @deepseek-ai/dsh@0.1.5-rc.1 web --no-open --host 127.0.0.1 --port 0`。不从 Harness 源码启动产品。

- 打开 App 显示本地启动页，服务就绪后由原生外壳用当次 token 完成官方 Cookie 交换，将 HttpOnly Cookie 写入 WebView，再加载不含 token 的工作区地址。启动地址与 token 不写入 App 或磁盘。
- 页面加载后检查工作区 HTML。首次跨站跳转若未携带 Strict Cookie，会从已经建立的工作区域内重载一次；仍失败则回到可重试的错误页，不反复显示 401。
- 自动分配本地端口，不接管或终止用户在终端启动的其他 dsh 服务。会话、凭据和三个插件仍使用现有 `~/.dsh` 配置。
- 关闭窗口和 ⌘Q 均退出 App，关闭服务管理进程的输入管道，清理其 npm/dsh 进程组。App 强制退出时也会触发管道 EOF 清理。
- 服务异常退出最多自动重试三次；启动超过五分钟或持续失败时显示错误与重试按钮。
- 已缓存的指定 npm 版本优先离线复用。首次安装需要网络；机器需要已有 nvm 与 Node 22.22.0。

## 构建

```sh
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 22.22.0
export PNPM_HOME="$HOME/Library/pnpm"
export PATH="$PNPM_HOME:$HOME/.cargo/bin:$PATH"
node scripts/build-app.mjs
```

脚本在 `.build/` 复制已安装的 Pake 模板，仅添加服务管理模块、两个本地启动页命令与退出回调，不修改全局 Pake 或 Harness 源码。新包生成于 `.build/output/DeepSeekHarness.app`，校验通过后再替换工作仓根目录的 App。图标源文件为 `assets/deepseek-harness.png` 与 `.icns`。

## 验证

```sh
node --test desktop/tests/service.test.mjs
node desktop/tests/npm-lifecycle.smoke.mjs
```

第一项使用测试子进程验证生命周期；第二项启动指定 npm 版本，验证认证、重启换 token、旧端口关闭与退出清理，不打开 GUI，也不执行 Agent 对话。
