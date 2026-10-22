# dsh-terminal

Terminal entry points backed by DeepSeek Harness's built-in terminal.

- The quick-prompts terminal icon is the only plugin entry; there is no conversation Terminal tab or launcher page. The card's Expand button docks and focuses the same running terminal in the official sidebar without changing the conversation view.
- Quick prompts present one official floating terminal pane inside a small card. DSH retains ownership of its renderer, PTY, authentication, session directory, output, input, resize and recovery.
- Interrupt sends Ctrl+C through the official terminal model. Closing a card closes only its own tab. Using the native dock action transfers that terminal back to the sidebar without ending it.
- There is no custom terminal HTTP route, node-pty runtime, duplicate xterm renderer or independent process inventory.

Run `pnpm run build` and `pnpm test`. Adapter tests cover sidebar launch, card ownership, interrupt, close, transfer to sidebar and failure cleanup. Actual pane geometry depends on the installed DSH DockKit floating-pane contract and must be checked after loading the plugin in the desktop app.
