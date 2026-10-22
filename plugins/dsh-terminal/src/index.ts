// Frontend entry points only. DSH's built-in webTerminals service owns the PTY,
// session scoping, authentication, input/output and terminal lifecycle.
export const name = 'dsh-terminal'
export function apply(): void {}
