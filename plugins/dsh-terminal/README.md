# dsh-terminal

An independent interactive terminal tab for DeepSeek Harness task conversations.

- Opens an interactive zsh in the current Session's canonical cwd. A task therefore starts in its independent output directory.
- Retains terminal state when switching tabs, with resize, clear, close and reconnect controls.
- Scopes terminal identifiers to the exact Session/cwd pair; the browser cannot supply an arbitrary starting directory.
- Limits concurrent terminals to 16 and retained output to 200,000 characters per terminal. Plugin/app shutdown closes its PTYs.
- Includes no project startup commands, automatic service management, updater or performance recorder.

This is a **local user terminal**, with the app user's OS permissions. Its starting-directory check is not a filesystem sandbox, and task read/write bindings do not restrict commands entered here. Agent file tools continue using the separate task resource policy. A task-resource directory selector and isolated Agent command execution are future integrations.

```sh
pnpm run build
pnpm exec tsc --noEmit
pnpm test
```

The five tests cover live/persisted Session directory resolution, invalid Session metadata, PTY state reuse, cross-session handle rejection, resizing, close and child-process cleanup. Native desktop validation executes `pwd` and a marker command inside a task.
