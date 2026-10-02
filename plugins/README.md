# dsh-forme plugins

The current bundle contains three independently installable DSH Web UI plugins:

| Package | Purpose |
| --- | --- |
| [dsh-git-plus](dsh-git-plus) | Git status, side-by-side diffs, branch selection, and commit-message generation. |
| [dsh-file-preview](dsh-file-preview) | Native file tree and previews, with file and code-selection references. |
| [dsh-quick-prompts](dsh-quick-prompts) | Saved chat prompts, independent agents, and shell commands. |

See the [installation and usage guide](../README.md) or [中文使用说明](../README.zh-CN.md).

From this directory, run `pnpm install --frozen-lockfile --ignore-scripts`, then `pnpm -r run build`. The explicit workspace list includes only these three plugins. Other historical or local experimental directories are not installed by the bundle.
