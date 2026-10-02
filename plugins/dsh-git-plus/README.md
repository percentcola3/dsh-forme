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
    gitExecutable: /path/to/git  # 空则使用 Host PATH 中的 git
    gitExecPath: ''              # 便携 Git 可填写 libexec/git-core 目录
    provider: ''                 # 空则优先使用 DSH 默认模型的 provider ID
    model: ''                    # 空则优先使用匹配 provider 的默认模型
    prompt: '用中文写一条 Conventional Commits 提交说明，只输出正文。'
```

桌面端同样使用上述配置，覆盖文件为 `~/.dsh/profiles/desktop/cordis.patch.yml`，修改后重启应用。若 macOS 系统 Git 被 Xcode 协议阻止，可指定已安装的其他 Git；插件会显示实际执行错误。配置只影响本插件的 Host Git 调用，不改变终端或 Agent 使用的 Git。

`git status` / `git diff` 由 Host 执行，且 cwd 必须属于已存在会话的工作目录（包括从持久化恢复的会话）。分支切换也由 Host 执行；提交和推送交给当前会话 Agent。

已在 DSH **0.2.0-rc.2** 验证变更、中文文件名、未跟踪文件对比和生成提交说明。支持尚未首次提交的新仓库。模型配置为空时跟随 DSH 默认配置；没有默认配置时按 provider ID 查找可用模型。模型错误或不完整结果会显示错误，不填入空说明。本轮未实际提交或推送项目。
