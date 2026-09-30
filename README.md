# dsh-forme

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）自用插件集。仓库根是一个元 bundle（`dsh-forme`），安装它即一并装下并启用全部五个 web 插件；各插件也可单独安装。

| 插件 | 作用 |
| --- | --- |
| `dsh-git-plus` | 对话标题旁 Git：当前工作区变更、diff 预览、可配置模型生成提交说明、经当前会话 Agent 提交/推送 |
| `dsh-file-preview` | 对话标题旁打开官方右侧 Files（Markdown / 代码预览走内置渲染） |
| `dsh-quick-prompts` | 输入框上方保存快捷提示词，点击直接发送，右键编辑 |
| `dsh-project-run` | 「运行」Tab：按项目保存 Shell 启动命令，查看输出、停止服务 |
| `dsh-version-update` | 左上角仅在有 npm 更新时显示角标，点击后下载并重启 |

## 安装

官方客户端「添加插件」对话框、或命令行。注意：scp 简写 `git@github.com:...` 会被 pnpm 误判为本地路径，请用完整 `git+ssh://` 或 https 形式：

```sh
# 整套装（推荐；走 SSH，稳定）
dsh plugin --profile web add git+ssh://git@github.com/percentcola3/dsh-forme.git

# 整套装（https 形式；本机直连 github 443 不稳时可能超时）
dsh plugin --profile web add https://github.com/percentcola3/dsh-forme

# 单个插件
dsh plugin --profile web add git+ssh://git@github.com/percentcola3/dsh-forme.git#path:plugins/dsh-git-plus
```

安装后重启 `dsh web`。纯 profile（无 web-app bundle）启动时，除 `dsh-file-preview` 外的插件会因等待 `webServer` 服务而挂起，属预期——在含 `@deepseek-ai/dsh-web-app` 的正常 profile 中使用。

## 开发

```sh
cd plugins && pnpm install && pnpm run build   # 或进入单个插件目录
dsh plugin --profile web add ./plugins/dsh-git-plus   # 本地联调
```

`desktop/` 为 macOS 桌面壳（Pake）源码，`scripts/build-app.mjs` 负责打包 `DeepSeekHarness.app`，与插件安装无关。
