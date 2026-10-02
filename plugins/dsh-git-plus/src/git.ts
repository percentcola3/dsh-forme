import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export function createGitRunner(config: { gitExecutable?: string; gitExecPath?: string } = {}) {
  const executable = config.gitExecutable?.trim() || 'git'
  const helperPath = config.gitExecPath?.trim()
  return async (cwd: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> => {
    try {
      const result = await execFileAsync(executable, args, {
        cwd,
        env: helperPath ? { ...process.env, GIT_EXEC_PATH: helperPath } : process.env,
        timeout: 20_000,
        maxBuffer: 4 * 1024 * 1024,
        windowsHide: true,
      })
      return { stdout: result.stdout, stderr: result.stderr, code: 0 }
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; code?: number }
      return {
        stdout: err.stdout ?? '',
        stderr: err.stderr || (error instanceof Error ? error.message : String(error)),
        code: typeof err.code === 'number' ? err.code : 1,
      }
    }
  }
}
