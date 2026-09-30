# dsh-git-plus

DeepSeek Harness Web 插件：在**当前会话对话栏标题旁**查看该工作区的 Git 变更、预览 diff，用可配置模型生成提交说明，再把 Commit / Commit & push 交给当前会话 Agent（走原有审批）。

## 安装

```sh
dsh plugin --profile web add ./plugins/dsh-git-plus
```

重启 `dsh web`。

## 配置

在 profile 的 `cordis.patch.yml` 覆盖：

```yaml
- id: dsh-git-plus
  config:
    provider: deepseek-official   # 空则用第一个已配置 provider
    model: deepseek-v4-flash      # 空则用该 provider 的第一个模型
    prompt: '用中文写一条 Conventional Commits 提交说明，只输出正文。'
```

只读 `git status` / `git diff` 由 Host 执行，且 cwd 必须属于当前 live session。Git 写操作不会由插件直接执行。
