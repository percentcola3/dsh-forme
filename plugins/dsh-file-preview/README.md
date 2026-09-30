# dsh-file-preview

点击顶部「文件」分段标签，切换到 **文件会话 Tab**：左边是完整的官方 Files 工作区树，右边是官方文档预览。未选文件时右侧显示提示，点击文件会替换右侧预览。支持目录展开、行悬停和当前文件选中效果。

文件区域仅占据会话 Tab 内容，保留顶部、左侧会话列表和底部输入栏；切回对话或 Changes 后恢复侧栏显示状态。不进入全屏，不自研文件树、Markdown 或代码渲染器。

官方组件仍由原始右侧栏挂载。插件使用会话区域的实时尺寸限定其显示边界，通过官方 split/openResourceIn 分栏及打开文件。该适配依赖 Harness 0.1.5-rc.1 的服务和 DOM 标记，升级后需要复核。

```sh
npx @deepseek-ai/dsh@0.1.5-rc.1 plugin --profile web add ./plugins/dsh-file-preview
```

首次安装需要重启服务；仅修改客户端后构建并在 App 内按 ⌘R，无需重打 App。

验证（Node 22）：

```sh
pnpm run build
node --test tests/files-workspace.test.mjs
```

在右侧文件预览中右键：有选区显示「将代码插入 Chat」，无选区显示「将文件插入 Chat」。使用官方文件引用 chip，文件名优先、长路径自动省略，悬停可看完整路径。代码选区可定位时附带行号；两者都只传路径与位置，不贴源码。保留原有草稿和引用，不自动发送。此前已插入的纯文本路径不自动改写。

顶部视图顺序为「对话 / 文件 / Changes / 轨迹」。右侧工作区路径为只读 chip，完整路径可悬停查看。
