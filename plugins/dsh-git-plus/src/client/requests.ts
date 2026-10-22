export async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(path, {
    method: 'POST', credentials: 'include',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  const text = await res.text()
  let data: T & { error?: string }
  try { data = JSON.parse(text) } catch {
    throw new Error(`Git request failed (${res.status} ${res.statusText || 'invalid response'}). Try refreshing the session.`)
  }
  if (!res.ok) throw new Error(data?.error || `Git request failed (${res.status} ${res.statusText})`)
  return data
}
