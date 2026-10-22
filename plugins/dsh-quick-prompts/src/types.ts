export type ModelSelection = { provider: string; model: string }
export type ModelChoice = ModelSelection & { label: string; providerLabel?: string }
export type Prompt = { id: string; name: string; text: string; gitOnly?: boolean; model?: ModelSelection | null }
export type RunStatus = 'starting' | 'running' | 'waiting' | 'stopping' | 'completed' | 'stopped' | 'failed'
export type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string }
export type TaskRun = {
  id: string; requestId: string; promptId: string; name: string
  projectId: string; cwd: string; dismissed?: boolean
  sessionKind?: 'conversation' | 'headless'
  parentId: string; parentTitle: string; childId: string
  status: RunStatus; startedAt: number; updatedAt: number; endedAt?: number
  messages?: ChatMessage[]
  output: string; liveOutput?: string; progress: string; error?: string; steps: number
  tools: { callId: string; name: string; state: 'running' | 'done' | 'failed' | 'ended' }[]
}
export const active = (status: RunStatus) => ['starting', 'running', 'waiting', 'stopping'].includes(status)
export const statusLabels: Record<RunStatus, string> = { starting: '启动中', running: '运行中', waiting: '需要处理', stopping: '停止中', completed: '已完成', stopped: '已停止', failed: '失败' }
