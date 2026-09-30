# dsh-version-update

左上角仅在 **npm 上有新版本** 时显示「有更新」。点击后下载 `@deepseek-ai/dsh@latest`、替换当前安装并重启 `dsh web`。

- **npx / 全局**：下载最新包并拉起新进程
- **源码检出**：不显示角标，也不执行 npm 更新

```sh
dsh plugin --profile web add ./plugins/dsh-version-update
```

不处理官方 Electron Desktop 的自动更新器。

## 临时性能诊断

App 打开后默认采样 10 分钟，左下角可停止/重新开始。日志：`~/.dsh/logs/ui-performance.jsonl`，5 MB 轮转一次，最多保留当前与上一份。

记录：Tab click 与 two-frames 耗时（不是内容完全加载时间）、可见页面超过 80ms 的帧间隔、环境支持时的 longtask、fetch 到响应头的耗时和每 3 秒计数、文件分栏 ready/慢同步、终端 ready。请求耗时不含响应体读取/解析；日志不包含正文、命令、路径或认证信息。运行 ID 与 switchId 用于关联事件。采样本身存在少量开销，不可将帧间隔直接等同于某个函数耗时。

诊断代码集中在 `src/performance-log.ts`、`src/client/performance.ts`；另在文件和终端客户端各加了时序标记。关闭记录后停止产生记录，不改变业务逻辑。尚未做优化，先收集复现数据。
