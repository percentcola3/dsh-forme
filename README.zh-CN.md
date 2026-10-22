# dsh-forme

**六个 DeepSeek Harness 插件，加一个 550W 智能体预设。**

在同一个工作区查看 Git 变更、浏览文件、运行轻量任务、使用终端，并接收桌面提醒。

[English](README.md) · [插件目录](plugins/README.md)

> 本文全部图片均为程序绘制的功能示意图，使用虚构内容。它们不是应用截图，不包含真实会话、账号、项目或本机路径。布局仅用于说明功能。

![六个插件和 550W 预设的功能总览](assets/readme/plugin-overview.svg)

## 插件一览

| 插件 | 入口 | 作用 |
| --- | --- | --- |
| [dsh-git-plus](plugins/dsh-git-plus/README.md) | Changes、项目分支菜单 | 查看状态和 diff，管理当前目录与子仓库的分支。 |
| [dsh-file-preview](plugins/dsh-file-preview/README.md) | 文件标签页 | 使用原生文件树和预览，将文件或代码选区引用加入草稿。 |
| [dsh-quick-prompts](plugins/dsh-quick-prompts/README.md) | 输入框上方快捷栏 | 无头任务 card、多轮输入、项目指令库、提交后推送，以及主会话辅助。 |
| [dsh-terminal](plugins/dsh-terminal/README.md) | 快捷栏终端图标 | 原生终端 card，可展开至官方侧栏。 |
| [dsh-desktop-notify](plugins/dsh-desktop-notify/README.md) | 账号菜单或通用设置 | macOS 原生木星提醒，提示完成、异常、审批和问题。 |
| [dsh-moss-theme](plugins/dsh-moss-theme/README.md) | 通用设置 | 550W 配色、字体、徽标、地球动效和实时任务状态。 |
| 550W 预设 | DSH 原生 Agent 预设选择器 | 简明表达、编码规范，以及 ego / LCU 工具选择说明。 |

主题与智能体预设独立。启用主题不会自动修改会话身份或系统提示词。

**可选独立扩展：** [dsh-markdown-preview](plugins/dsh-markdown-preview/README.md) 增加 Markdown 文件阅读配色，并复用社区 Mermaid 图表插件。它需要单独安装，不包含在默认六插件整包中。

## 安装

### 推荐：macOS 官方桌面端，本地安装

准备好 DeepSeek Harness Desktop、Git，以及 Node.js **22.18+（22.x）或 24.11+**。桌面原生提醒还需要 Xcode Command Line Tools，首次使用时编译 Swift 辅助程序。

```sh
git clone https://github.com/percentcola3/dsh-forme.git
cd dsh-forme
npm run install:desktop
```

安装脚本使用桌面应用自带的 pnpm 和 CLI，构建六个插件，并安装到 Desktop profile。

1. 完整退出并重新打开 DSH。
2. 打开「插件」，确认 `dsh-forme` 的六个插件组件正常运行。
3. 新建或选择一个带工作目录的会话。
4. **550W 预设默认不启用**。如需使用，请先自行安装并配置 ego（`ego-browser`）和 LCU Computer Use。
5. 确认 DSH 可以调用这两种工具。
6. 在「插件」中启用 `preset-moss`，再从原生 Agent 预设选择器中选择「550W」。

这是本地链接安装。安装后请保留仓库目录。插件管理器还会列出 550W 预设，因此整包共有七个组件。

应用不在默认位置时，可以指定资源目录：

```sh
DSH_APP_RESOURCES='/path/to/DeepSeek Harness.app/Contents/Resources' npm run install:desktop
```

### 从 GitHub 安装

在 DSH 的「添加插件」中填写：

```text
git+ssh://git@github.com/percentcola3/dsh-forme.git
```

整包的 Git 依赖使用 SSH，需要可用的 GitHub SSH 访问。没有配置 SSH 时，使用前面的 HTTPS 克隆与本地安装方式。仓库包含插件构建产物。

已有 `dsh` CLI 的 Web profile 可以安装整包：

```sh
dsh plugin --profile web add 'git+ssh://git@github.com/percentcola3/dsh-forme.git'
```

也可以按需安装单个插件：

```sh
dsh plugin --profile web add 'git+ssh://git@github.com/percentcola3/dsh-forme.git#path:plugins/dsh-git-plus'
```

将最后的包名替换为表格中的任一插件。安装终端 card 时同时安装快捷任务插件，因为入口在快捷栏。完成后重启 `dsh web`。纯 CLI profile 缺少 Web UI 服务，不能运行完整插件集。

### 更新

先保存自己的本地改动，再执行：

```sh
git pull --ff-only
npm run install:desktop
```

更新后完整退出并重新打开 DSH。

## 1. Git 状态、变更和分支

![Git 文件列表、左右差异和分支的虚构示意图](assets/readme/git.svg)

- 在 **Changes** 中查看变更文件和左右 diff。
- 查看新增、修改、删除与未跟踪文件，以及增删行数。
- 在项目分支菜单中查看当前仓库及子目录中的仓库。
- 支持已有 submodule 和 linked worktree。
- 搜索本地分支和已获取的远程跟踪分支。
- 选择远程跟踪分支时，创建同名本地分支并配置上游。

切分支只作用于选中的仓库。Git 拒绝切换时，插件显示错误，不强制覆盖工作区。仓库扫描和行数统计有预算；达到限制时会标明结果不完整。

**提交和推送从快捷任务栏的「推送」启动。** Git 插件负责查看与分支管理。它不会把提交指令插入当前主对话。

## 2. 文件浏览和上下文引用

![文件树、代码预览和草稿引用的虚构示意图](assets/readme/files.svg)

1. 打开「文件」标签页。
2. 在左侧目录树选择文件，在右侧查看原生预览。
3. 右键选择「将文件插入 Chat」。
4. 如需引用代码，先选择代码，再选择「将代码插入 Chat」。
5. 补充问题后自行发送。

引用保留有效路径，并在可定位时附带行号。它不会把源码直接粘贴进草稿，也不会自动发送。已有草稿和引用会保留。头部还提供项目路径复制入口。

## 3. 快捷任务和无头 card

![主对话与独立任务 card 的虚构示意图](assets/readme/tasks.svg)

点击输入框上方的 **+**，保存名称和任务内容。点击指令执行，点击铅笔或右键编辑。快捷指令默认使用 **DeepSeek Flash**，也可固定其他模型，或显式选择跟随主会话模型。每个项目保存独立副本；同一目录的会话共用该项目的指令。

- 每个任务使用独立无头 Agent 和当前项目目录，不复制主会话历史。
- card 显示用户消息与 AI 正文，并支持同上下文多轮输入。
- Enter 发送，Shift+Enter 换行；中文输入法确认不会误发送。
- card 只出现在启动它的主会话中，不加入项目或「未分组」对话列表。
- 完成、失败或停止后仍保留 card，方便查看与追问。
- 关闭 card 会停止该任务并释放运行资源，不影响其他 card 或主会话。

Git 工作区默认只有 **「推送」**：检查范围和目标，执行适当检查，提交相关改动，再正常推送。没有新改动时仍可推送已有提交。检查或提交失败时停止，不强制推送。用户修改过的旧指令会保留。

**使用边界：** card 不提供额外审批入口；需要额外权限时报告限制。澄清问题通过 card 正文和输入框处理。DSH 底层仍保留日志；关闭 card 不删除这些日志。重启 DSH 后不恢复 card。

该插件还提供三项主会话辅助：

| 功能 | 行为 |
| --- | --- |
| 草稿复用 | 优先复用当前项目已有草稿空会话，减少重复空会话。 |
| 重启续接 | 对插件观察到的、因退出或崩溃中断的普通主会话，按条件尝试续接一次。主动停止、已完成或错误阻塞的任务不自动恢复。 |
| 自动标题 | 正常结束一轮后，依据公开对话更新自动标题。保留手动标题；会增加一次模型调用。 |

## 4. 原生终端 card

![终端 card 展开至原生侧栏的虚构示意图](assets/readme/terminal.svg)

从快捷栏终端图标打开小窗口，直接输入 shell 命令。插件复用 DSH 的原生终端、PTY、目录和恢复能力。

- 「中断」向当前终端发送 Ctrl+C。
- 「展开」将同一个终端移到官方侧栏，不创建第二个 shell。
- 收起 card 或切换项目不会结束终端。
- 「关闭」结束该 card 对应的终端。

终端归属创建它的会话。同项目的其他会话可以通过「返回原终端」入口返回。

## 5. 桌面任务提醒

![普通完成与需要处理状态的木星提醒示意图](assets/readme/notify.svg)

在账号菜单的「桌面提醒」或通用设置中配置。提醒使用 macOS 原生悬浮窗；DSH 在后台或最小化时也可显示，不抢键盘焦点。

- 正常完成显示缓慢自转的木星。
- 审批、问题和异常显示泛红、加速自转的木星。
- 可选屏幕四角和四边中点、主显示器或鼠标所在显示器。
- 可配置自动收起时长、提醒类别和提示音。
- 点击提醒回到对应会话；同时到达的提醒会排队。

提醒消失不会批准操作、回答问题或取消任务。当前原生位置功能支持 **macOS 12+**；其他平台不提供同等原生悬浮窗。

## 6. 550W 主题与预设

![550W 主题和智能体预设分离的示意图](assets/readme/theme.svg)

主题包含深蓝灰界面、本地字体、项目徽标、地球首页、任务航行条和土星状态图标。状态来自当前会话；动效不代表任务成功。设置中可分别控制主题、纹理和动效，并遵循系统减少动态效果设置。

**550W 预设**使用标准工具组合，并加入明确的工作规范：

- 短句、术语一致，先结论，再依据和下一步。
- 先读代码、找根因、做最小修改，并报告真实检查结果。
- 浏览器操作可以使用 `ego-browser` 技能。
- 浏览器之外的操作可以使用 LCU Computer Use。

预设依赖 ego 和 LCU Computer Use，因此默认不启用。请先自行安装并配置这两种工具，再启用 `preset-moss`。主题可独立使用。本插件不会自动安装这些工具，也不会绕过权限和审批。

## 兼容性与常见问题

当前主要适配 **macOS 官方 Desktop 0.2.1-rc.2**。部分功能曾在 0.2.0-rc.2 验证；新 DSH 版本仍需复核。不要将这些记录理解为跨平台或所有版本保证。

| 问题 | 检查方法 |
| --- | --- |
| 根包已安装，组件未运行 | 本地安装请执行 `npm run install:desktop`，直接链接根目录不会补齐依赖。 |
| 文件或 Git 内容为空 | 选择带工作目录的会话，并确认目录属于 Git 工作区。 |
| macOS Git 不可用 | 按 Git 插件说明配置已有 Git 可执行文件。该设置只影响插件自身。 |
| 快捷任务无法执行 | 查看 card 错误，核对模型、主会话状态和权限。无需 `spawn` provider。 |
| 提醒不出现 | 核对 macOS 版本、提醒设置和 Xcode Command Line Tools。 |
| DSH 升级后界面异常 | 核对插件兼容性，更新后重新加载应用。 |

## 开发与图示来源

```sh
cd plugins
pnpm install --frozen-lockfile --ignore-scripts
pnpm -r run test
pnpm -r exec tsc --noEmit
pnpm -r run build
```

修改源码后同步插件的 `lib/` 构建产物。Host 变更需要重新加载插件或应用。Git 测试使用临时仓库；不要用真实提交或推送代替测试。

六张功能图通过 `node scripts/generate-readme-art.mjs` 生成。功能总览为静态矢量图。图中所有文本均为示例，不采集真实屏幕。早期 `desktop/` 自定义外壳不属于当前官方桌面安装流程。

## 许可

[MIT](plugins/dsh-git-plus/LICENSE)。主题为非官方致敬，素材及字体的独立来源与许可见[主题 NOTICE](plugins/dsh-moss-theme/NOTICE)。
