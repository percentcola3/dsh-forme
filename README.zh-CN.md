# dsh-forme

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 提供三个插件：Git 变更对比、文件预览与引用、自定义快捷任务。直接复用 DSH 的工作区、会话、模型及审批能力。

[English](README.md)

已在 **macOS 官方桌面端 0.2.0-rc.2** 验证。

## 插件能力

| 插件 | 用途 |
| --- | --- |
| `dsh-git-plus` | Changes 标签页、左右 diff、分支切换、AI 生成提交说明，以及交给当前 Agent 的提交/推送操作。 |
| `dsh-file-preview` | 文件标签页，使用官方文件树和 Markdown/代码预览，把文件或代码选区引用加入输入框。 |
| `dsh-quick-prompts` | 在输入框上方保存快捷任务，支持当前对话、独立 Agent、Shell 命令三种模式。 |

根安装包只启用这三个插件。任务工作区、独立终端等实验不包含在本次安装包中；快捷任务里的 Shell 命令仍可使用。

## 安装到官方桌面端

这是已验证的 macOS 安装方式。先安装 DeepSeek Harness Desktop、Git，以及 **Node.js 22.18 及以上的 22.x 版本，或 24.11 及以上版本**：

```sh
git clone https://github.com/percentcola3/dsh-forme.git
cd dsh-forme
npm run install:desktop
```

脚本使用桌面应用自带的 pnpm 和 CLI，构建三个插件并补齐本地依赖链接，安装到 `~/.dsh/profiles/desktop`。完成后退出并重新打开 DSH，在「插件」中确认三个组件均为运行状态。此方式是本地链接安装，安装后请保留仓库目录。

如果应用没有安装在默认位置，可指定资源目录：

```sh
DSH_APP_RESOURCES='/path/to/DeepSeek Harness.app/Contents/Resources' npm run install:desktop
```

也可以在 DSH「添加插件」中填写：

```text
git+ssh://git@github.com/percentcola3/dsh-forme.git
```

根安装包的 Git 依赖使用 SSH，需要已配置 GitHub SSH 访问；没有配置 SSH 时，可使用前面的 HTTPS 克隆与本地安装方式。仓库包含构建产物，加载插件不依赖客户端批准构建脚本。

Web 版可用以下命令安装整套或单个插件，完成后重启 `dsh web`：

```sh
dsh plugin --profile web add 'git+ssh://git@github.com/percentcola3/dsh-forme.git'
dsh plugin --profile web add 'git+ssh://git@github.com/percentcola3/dsh-forme.git#path:plugins/dsh-git-plus'
```

单个插件地址末尾可替换为 `dsh-file-preview` 或 `dsh-quick-prompts`。请使用完整的 `git+ssh://` 地址，pnpm 可能把 `git@github.com:...` 识别为本地路径。需要含 DSH Web UI 服务的 profile，纯 CLI profile 无法运行完整插件集。

## 怎么使用

先新建或选择一个有工作目录的 DSH 会话。

### Git 对比与提交说明

1. 点击 **Changes**，查看变更文件和增删行数。
2. 选择文件，查看左右 diff；支持中文路径、未跟踪文件和尚未首次提交的新仓库。
3. 点击分支下拉框查看、切换本地分支；若有冲突，显示 Git 返回的错误。
4. 打开 **Commit & Push**，点击「生成说明」，或自行填写提交说明。
5. 确认需要执行后，点击 **Commit** 或 **Commit & Push**，当前 DSH Agent 会接收指令，进度和审批出现在对话中。

只生成说明不会提交文件。推送需要配置 upstream。默认使用 DSH 的默认模型；自定义 Git 路径、模型和提示词见 [Git 配置说明](plugins/dsh-git-plus/README.md)。

### 文件预览与上下文引用

1. 点击「文件」，在左侧展开目录，点击文件后在右侧预览。
2. 在预览中右键，选择「将文件插入 Chat」。
3. 对代码文件，可先选中几行，再右键选择「将代码插入 Chat」，输入框会附带可识别的行号。
4. 补充问题后正常发送；点击文件引用可以重新打开对应文件。

插入引用会保留原有草稿，不会自动发送。引用包含路径和可选行号，不直接粘贴源码。切回对话或 Changes 后恢复正常侧栏布局。

### 自定义快捷任务

点击输入框上方的 **+**，填写名称、执行方式和内容，然后保存。点击按钮执行，点击铅笔或右键可编辑。

| 执行方式 | 行为 | 示例 |
| --- | --- | --- |
| 当前对话 | 发送保存的完整提示词，沿用当前模型和上下文，保留输入草稿。 | 检查当前改动，先说明可能的回归风险，不要修改文件。 |
| 独立 Agent | 在相同目录新建会话，不复制原聊天历史；可指定模型和思考强度。 | 阅读项目，起草一份新人上手说明，不修改源代码。 |
| 终端命令 | 通过 `/bin/zsh` 直接在当前目录运行，显示输出与退出码。 | `pwd`、`npm test` |

独立 Agent 的「查看结果/审批」会打开对应会话，任务栏提供停止操作。Shell 输出面板中可点击「停止命令」。每个目录同时运行一个快捷命令，适用于前台、非交互命令，不提供终端输入；命令所需工具应已安装在 DSH 所在机器上。

快捷任务保存在 `~/.dsh/quick-prompts.json`。按钮最多显示五个字符，悬停查看完整名称；最近的独立 Agent 结果链接保存在本机客户端。

## 更新本地安装

```sh
cd /path/to/dsh-forme
git pull --ff-only
npm run install:desktop
```

更新后退出并重新打开 DSH。若有自己的本地修改，请先保存或提交，再拉取更新。

## 常见问题

- **根插件已安装，组件却未运行**：本地目录请使用 `npm run install:desktop`；直接添加根目录只会创建链接，不会安装根包依赖。
- **没有文件或 Git 内容**：先选择有工作目录的会话；Git 还需要有效仓库和可执行的 Git。
- **macOS 系统 Git 不可用**：可在 [Git 配置](plugins/dsh-git-plus/README.md) 中指定已有的其他 Git 及 helper 路径，此设置仅影响插件本身。
- **生成提交说明失败**：检查 DSH 模型配置或插件中填写的 provider/model ID。
- **Shell 找不到命令**：命令继承 DSH 进程环境，可使用完整可执行路径或显式设置环境变量。
- **升级 DSH 后界面异常**：插件依赖官方服务和文件面板 DOM 标记，目前已验证版本为 0.2.0-rc.2。

## 开发与验证

```sh
cd plugins
pnpm install --frozen-lockfile --ignore-scripts
pnpm -r run test
pnpm -r exec tsc --noEmit
pnpm -r run build
```

Git 测试使用临时仓库，可通过 `DSH_TEST_GIT` 和 `DSH_TEST_GIT_EXEC_PATH` 指定便携 Git。源代码变更后请重新构建并提交三个插件的 `lib/` 产物；Host 变更需要重启 DSH。

2026-10-02 已通过 **37 项测试、类型检查与构建**。官方桌面端实测了 Git diff 与说明生成、文件及代码选区引用、当前对话与独立 Agent 的真实响应，以及退出码为 0 的 Shell 命令。该轮桌面验收未实际执行提交/推送。

`desktop/` 是早期自定义桌面壳，官方桌面端安装不需要它。许可证：[MIT](plugins/dsh-git-plus/LICENSE)。
