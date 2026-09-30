# DeepSeek Harness 插件

五个互相独立的 Web 插件，可单独安装、关闭。

| 包 | 作用 |
| --- | --- |
| `dsh-git-plus` | 对话标题旁 Git：当前工作区变更、diff 预览、可配置模型生成提交说明、经当前会话 Agent 提交/推送 |
| `dsh-file-preview` | 对话标题旁打开官方右侧 Files（Markdown / 代码预览走内置渲染） |
| `dsh-quick-prompts` | 输入框上方保存快捷提示词，点击直接发送，右键编辑 |
| `dsh-project-run` | 「运行」Tab：按项目保存 Shell 启动命令，查看输出、停止服务 |
| `dsh-version-update` | 左上角仅在有 npm 更新时显示角标，点击后下载并重启 |

在已运行的 `dsh web` 环境中：

```sh
dsh plugin --profile web add ./plugins/dsh-git-plus
dsh plugin --profile web add ./plugins/dsh-file-preview
dsh plugin --profile web add ./plugins/dsh-version-update
npx @deepseek-ai/dsh@0.1.5-rc.1 plugin --profile web add ./plugins/dsh-project-run
```

安装后重启 `dsh web`。每个子目录可独立 `pnpm install && pnpm run build`。
