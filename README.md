# dsh-forme

Four focused plugins for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): inspect Git changes, browse and reference files, run reusable tasks, and switch to a Wandering Earth inspired 550W console.

[中文使用说明](README.zh-CN.md)

Tested with **DeepSeek Harness Desktop 0.2.0-rc.2 on macOS**. The plugins extend DSH's existing workspace and conversation UI. They use its session, model, file preview, and approval services.

## What's included

| Plugin | What it adds |
| --- | --- |
| [`dsh-git-plus`](plugins/dsh-git-plus) | A Changes tab, side-by-side diffs, branch selection, AI commit messages, and commit/push requests sent to the current agent. |
| [`dsh-file-preview`](plugins/dsh-file-preview) | A Files tab with the official file tree and Markdown/code previews; insert file and code-selection references into your draft. |
| [`dsh-moss-theme`](plugins/dsh-moss-theme) | Wandering Earth inspired dark console, minimal status light, live session status, and a local theme toggle. |
| [`dsh-quick-prompts`](plugins/dsh-quick-prompts) | Saved shortcuts above the composer: send a prompt, launch an independent agent, or execute a shell command. |

The root bundle installs these **four plugins**. Experimental task workspaces and a standalone terminal are outside this bundle. Shell commands remain available inside Quick Prompts.

## Install

### Desktop: install from a local checkout

This is the installation path validated with the official macOS app. Install DeepSeek Harness Desktop, Git, and **Node.js 22.18+ in the 22.x line, or 24.11+** first.

```sh
git clone https://github.com/percentcola3/dsh-forme.git
cd dsh-forme
npm run install:desktop
```

The script uses the app's bundled pnpm and CLI to build the four plugins, link their local dependencies, and install the bundle into `~/.dsh/profiles/desktop`. Quit and reopen DSH, then open **Plugins / 插件** and check that all four components are running. Keep the checkout in place: this is a linked installation.

If the app is installed elsewhere:

```sh
DSH_APP_RESOURCES='/path/to/DeepSeek Harness.app/Contents/Resources' npm run install:desktop
```

### Install from GitHub

In DSH's **Add Plugin / 添加插件** dialog, use:

```text
git+ssh://git@github.com/percentcola3/dsh-forme.git
```

GitHub SSH access is required for the bundle's Git dependencies. Use the local-checkout installer above if you prefer HTTPS cloning without configuring SSH. The repository includes built plugin files, so loading the plugins does not depend on a client-side build approval.

For a DSH Web profile with the `dsh` CLI available:

```sh
# Install the bundle.
dsh plugin --profile web add 'git+ssh://git@github.com/percentcola3/dsh-forme.git'

# Or install only one component.
dsh plugin --profile web add 'git+ssh://git@github.com/percentcola3/dsh-forme.git#path:plugins/dsh-git-plus'
```

Replace the final package name with `dsh-file-preview`, `dsh-quick-prompts`, or `dsh-moss-theme` as needed. Restart `dsh web` after installing. Use the full `git+ssh://` form; pnpm may interpret `git@github.com:...` as a local path. These are Web UI plugins: a bare CLI profile without DSH's web-app services cannot run the complete bundle.

## Use the plugins

Start or select a DSH conversation with a working directory. Git actions use that repository; files and shell shortcuts use that conversation's directory.

### Git changes and commit messages

1. Open **Changes** to see changed files and insertion/deletion counts.
2. Select a file to compare its before/after contents. Unicode filenames, untracked files, and repositories without a first commit are supported.
3. Use the branch dropdown to inspect or switch local branches. Git reports conflicts that prevent switching.
4. Open **Commit & Push**, then choose **生成说明** to generate a commit message, or enter one yourself.
5. Choose **Commit** or **Commit & Push** when ready. This sends an instruction to the current DSH agent; progress and any approval requests appear in the conversation.

Generating a message does not create a commit. A push needs a configured upstream. Empty model settings use DSH's default model selection. Custom Git executables, providers, models, and prompts are described in the [Git configuration guide](plugins/dsh-git-plus/README.md).

### Browse files and add context

1. Open **文件 / Files**. Expand folders in the left tree and select a file to preview it on the right.
2. Right-click inside the preview and choose **将文件插入 Chat** to add a file reference to your input draft.
3. For code, select the relevant lines first, then right-click and choose **将代码插入 Chat**. The reference includes line numbers when they can be determined.
4. Add your question and send it normally. Clicking the reference reopens the file.

References preserve the existing draft and do not automatically send a message. They carry the file path and optional line context, rather than pasting the source code. Switching back to Conversation or Changes restores the normal sidebar layout.

### Save and run shortcuts

Click **+** above the composer, enter a name, select an execution mode, and save. Click a shortcut to run it; use its pencil button or right-click to edit it.

| Mode | Behavior | Example |
| --- | --- | --- |
| **当前对话 / Current chat** | Sends the saved text using the current model and conversation context; leaves your draft intact. | `Review the current changes. Explain any regression risks before editing files.` |
| **独立 Agent / Independent agent** | Creates a new conversation in the same directory without copying chat history. Choose a model and reasoning level, or use the default. | `Inspect this project and draft a concise onboarding guide. Do not modify source files.` |
| **终端命令 / Shell command** | Runs the saved command directly in the working directory through `/bin/zsh`; shows output and exit code. | `pwd` or `npm test` |

For independent agents, **查看结果/审批** opens the result conversation; its task control can stop the run. Shell output has a **停止命令** control. Shell shortcuts support one active command per directory and foreground, non-interactive commands; they do not provide terminal input. The commands you use must already be installed on the DSH host.

Shortcut definitions are saved in `~/.dsh/quick-prompts.json`. Button labels show up to five characters; hover to see the full name. Recent independent-agent result links are stored locally in the client.

### 550W console theme

The theme uses a midnight-blue terminal palette with red accents, an animated pale-blue Earth with a flowing atmospheric wake, and transmission-style AI replies. The hand-drawn 550W wordmark appears in the sidebar, console, and host startup screen. A dedicated title bar provides desktop dragging; the official Electron app retains its native minimize/zoom controls, Tauri carriers use their window bridge, and browsers offer fullscreen.

Open **550W** in the conversation header for theme, texture, and motion settings. The breathing light follows the selected session: standby, connecting, working, waiting for interaction, error, or unavailable. The running indicator reads DSH's own elapsed time. Settings are local, reduced-motion preferences are respected, and bundled imagery/fonts work offline.

**接入 550W** opens a new conversation with the included 550W agent preset; existing conversations keep their preset. An optional copyable style instruction is also available. Disabling the theme restores DSH's colors and branding; disabling the plugin removes its controls. For compatibility, the package remains `dsh-moss-theme` and the preset ID remains `moss`. See the [plugin guide](plugins/dsh-moss-theme/README.md) for installation, preview, and validation details. Startup branding, sidebar identity, dragging and native window actions were checked on macOS Desktop **0.2.1-rc.2**; simulated states and cleanup have automated coverage.

## Update a local installation

```sh
cd /path/to/dsh-forme
git pull --ff-only
npm run install:desktop
```

Quit and reopen DSH after updating. Preserve or commit your own local changes before pulling.

## Troubleshooting

- **Bundle installed, components not running:** for local checkouts, use `npm run install:desktop`. Adding the root folder directly creates a link but does not install that folder's dependencies.
- **No workspace or Git data:** select a conversation with a working directory. Git features also require a Git repository and a working Git executable on the host.
- **Git fails on macOS:** if the system Git is unavailable, configure an existing alternative executable and its helper directory in [Git settings](plugins/dsh-git-plus/README.md). This setting applies to the plugin's Git calls, not the agent's shell.
- **Commit-message generation fails:** verify DSH's model setup or the plugin's provider/model IDs. Failed or incomplete model responses are shown as errors.
- **A shell shortcut cannot find a command:** it inherits the DSH host's environment. Use an executable path or set the command's environment explicitly.
- **An upstream DSH update changes the UI:** this integration depends on DSH services and file-pane DOM markers. Compatibility beyond 0.2.0-rc.2 has not been verified.

## Development and validation

Use a supported Node.js version and pnpm:

```sh
cd plugins
pnpm install --frozen-lockfile --ignore-scripts
pnpm -r run test
pnpm -r exec tsc --noEmit
pnpm -r run build
```

Git tests use temporary repositories. To use a portable Git distribution, set `DSH_TEST_GIT` and optionally `DSH_TEST_GIT_EXEC_PATH`. Rebuild and include the four plugins' `lib/` files with source changes; restart DSH after Host changes.

Validation on 2026-10-02: **37 tests passed**, plus type checks and builds. Native desktop checks covered Git diffs and message generation, Markdown/code previews and clickable selection references, real chat/independent-agent responses, and shell output with exit code 0. Commit/push execution was not part of that desktop acceptance run.

`desktop/` contains the earlier custom desktop wrapper. It is not required by the official-app installation above.

## License

MIT — see the [plugin license](plugins/dsh-git-plus/LICENSE).
