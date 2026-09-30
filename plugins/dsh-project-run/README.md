# dsh-project-run

独立、可关闭的项目调试插件。首次在「配置启动命令」保存 `yarn dev` 等命令，以后直接使用会话顶部「启动 / 重启 / 中断」快捷按钮，无需手敲命令。「配置 / 日志」打开弹窗修改配置、查看 stdout/stderr。独立的「终端」Tab 打开当前会话目录的交互式 zsh。

重启会先清理旧进程再执行保存的命令，重复重启请求会合并。中断会结束当前项目进程组，保留命令与日志。

- 命令通过 `/bin/zsh -c` 在当前 会话 的工作目录执行，继承 App 的 Node 22、pnpm 环境。
- 启动按钮先保存当前命令再执行。每个工作目录最多一个运行实例，多会话打开同一项目时共享状态。
- 切换 Tab 继续运行；停止先 SIGTERM，再清理同一进程组中残留的子进程。正常退出 App/服务或卸载插件会清理任务。
- 命令保存在 `~/.dsh/project-run/<cwd-sha256>.json`，重启后保留，但不会自动运行。
- 使用前台命令，例如 `npm run dev`、`pnpm dev`。快捷启动的日志面板不支持密码输入、vim 或主动脱离进程组的 daemon。强制 SIGKILL 服务不执行退出清理。
- 输出最多保留最近 200,000 字符，日志仅在打开配置弹窗时轮询，顶部快捷控制只读取轻量状态。退出码、启动错误和截断状态可见。
- 路由复用官方认证/来源校验；cwd 只从 会话 解析，客户端不能指定任意执行目录。

```sh
npx @deepseek-ai/dsh@0.1.5-rc.1 plugin --profile web add /Users/didi/OpenSource/Deepseek/plugins/dsh-project-run
```

新增 Host 插件后完整退出并重开 DeepSeekHarness.app，App 会自动重启 npm 服务。此项目现有 App 已使用动态认证启动，不需要重打 Pake。

验证（Node 22.22.0）：`pnpm run build`、`pnpm test`、`pnpm exec tsc --noEmit`。

历史会话未加载进运行内存时，通过官方 sessionPersistence.stat 获取工作目录，不会为了启动项目而先唤起 Agent。

## 交互式终端

「终端」Tab 使用 xterm.js + node-pty；支持逐键输入、Tab 补全、Ctrl+C、终端尺寸变化和清屏。每个会话/目录保留一个 PTY，切换 Tab 后继续运行；关闭终端后可重新打开，正常退出 App 会清理。最多 16 个终端，每个保留最近 200,000 字符用于重新进入时恢复显示。终端与顶部快捷启动进程互相独立。主动脱离终端的守护进程不属于清理范围。

macOS 安装/构建时会修正 node-pty 随包 spawn-helper 的可执行权限。
