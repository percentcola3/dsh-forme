# dsh-forme plugins

The bundle contains **six plugins and the 550W agent preset**.

| Package | Purpose |
| --- | --- |
| [dsh-git-plus](dsh-git-plus/README.md) | Git status, side-by-side diffs, repository discovery, and branch selection. |
| [dsh-file-preview](dsh-file-preview/README.md) | Native file tree and previews, with file and code-selection references. |
| [dsh-quick-prompts](dsh-quick-prompts/README.md) | Project shortcuts, headless task cards with follow-up input, commit-and-push, draft reuse, restart continuation, and automatic titles. |
| [dsh-terminal](dsh-terminal/README.md) | Native terminal cards through the Quick Prompts bar, with interrupt, close, and transfer to the official sidebar. |
| [dsh-desktop-notify](dsh-desktop-notify/README.md) | Native macOS Jupiter alerts for completion, errors, approvals, and questions. |
| [dsh-moss-theme](dsh-moss-theme/README.md) | 550W appearance, live task-state visuals, and an independently selected agent preset. |

See the illustrated [English guide](../README.md) or [中文使用说明](../README.zh-CN.md) for installation and features. All guide illustrations use fictional data; none are screenshots.

From this directory:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm -r run test
pnpm -r exec tsc --noEmit
pnpm -r run build
```

The workspace includes the six packages above and the optional [dsh-markdown-preview](dsh-markdown-preview/README.md) package. The optional package adds Markdown file colors and community Mermaid diagrams; install it separately. The historical desktop wrapper is not required by the official-app installation.
