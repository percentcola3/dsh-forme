# dsh-markdown-preview

独立、按需安装的 Markdown 阅读增强包。它保留 DSH 官方文件加载和 Markdown 渲染。

## 功能

- 标题分级配色，以及链接、引用、列表、表格和行内代码的阅读样式。
- 配色使用宿主主题变量，适应浅色、深色和 550W 主题。
- 正文样式只作用于 Markdown 文件预览，包括官方侧栏及 Files 工作区。
- 保留官方代码高亮、复制、换行、相对图片路径和文件引用行为。
- 复用社区 [dsh-mermaid-preview](https://github.com/realguan/dsh-mermaid-preview) 提供 Mermaid 图表。
- 社区图表组件提供离线引擎、8 套配色、源码切换、放大查看和错误回退。

本包不依赖 `dsh-file-preview` 或 `dsh-moss-theme`。它不属于 `dsh-forme` 默认安装的六个插件。

## 安装

从仓库根目录执行：

```sh
pnpm --dir plugins install --frozen-lockfile
pnpm --dir plugins/dsh-markdown-preview run build

dsh plugin --profile desktop add "link:$(pwd)/plugins/dsh-markdown-preview"
```

Web 用户把 `desktop` 改为 `web`。也可以在 DSH「添加插件」中填写这个插件目录的绝对路径。

安装后重启 DSH。本地链接安装需要保留仓库目录。

本包有两个组件：

| 组件 ID | 作用 |
| --- | --- |
| `dsh-markdown-preview` | Markdown 文件的正文阅读样式 |
| `dsh-markdown-mermaid` | 社区 Mermaid 图表渲染 |

如果已经单独安装 `dsh-mermaid-preview`，请只启用一个 Mermaid 组件。宿主不会自动合并两个包的组件。

只需要图表时，可以直接安装社区包：

```sh
dsh plugin --profile desktop add github:realguan/dsh-mermaid-preview#fcbb7e3ff3c273962524a9bb5610aeb4f01c6cb3
```

## 社区实现与边界

本包将社区依赖锁定到提交 `fcbb7e3ff3c273962524a9bb5610aeb4f01c6cb3`（包版本 `0.6.0`）。该提交内置 Mermaid `11.17.2`，不依赖 CDN。GitHub HTTPS 仅用于安装时获取依赖。

社区组件作用于共享 Markdown 视图，包括聊天和文件预览。正文阅读样式只作用于文件预览。

当前宿主不会为未知代码语言保留可靠的 DOM 标记。社区组件因此根据代码内容识别 Mermaid。以 `flowchart`、`graph` 等图表声明开头的普通文本代码块也可能被识别。可以使用卡片的源码切换查看原文。

社区组件使用 Mermaid strict 模式。渲染失败时显示提示并保留源码。关闭组件会清理其观察器、样式和附加节点。

## 验证

在此插件目录执行：

```sh
pnpm run build
pnpm run typecheck
pnpm test
```

自动化测试覆盖编译后的模块注册、样式启用/卸载/重启，以及包入口和依赖配置。浏览器测试使用虚构文档和宿主 DOM 结构；它不等同于当前 DSH 会话的安装验收。

## 许可

本包使用 MIT 许可。社区图表代码与 Mermaid 引擎由依赖包提供，保留各自的许可文件。
