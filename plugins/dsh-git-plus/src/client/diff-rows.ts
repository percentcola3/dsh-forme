export type SplitLine = {
  leftNo: number | null
  rightNo: number | null
  left: string
  right: string
  kind: 'ctx' | 'del' | 'add' | 'replace'
}

export function splitUnifiedDiff(diff: string): SplitLine[] {
  const rows: SplitLine[] = []
  let leftNo = 0
  let rightNo = 0
  const pendingDel: string[] = []
  const flushDel = (): void => {
    while (pendingDel.length > 0) {
      const text = pendingDel.shift() ?? ''
      leftNo += 1
      rows.push({ leftNo, rightNo: null, left: text, right: '', kind: 'del' })
    }
  }
  for (const line of diff.split('\n')) {
    if (
      line.startsWith('diff ')
      || line.startsWith('index ')
      || line.startsWith('---')
      || line.startsWith('+++')
    ) continue
    if (line.startsWith('@@')) {
      flushDel()
      const mark = /@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(line)
      if (mark) {
        leftNo = Number(mark[1]) - 1
        rightNo = Number(mark[2]) - 1
      }
      continue
    }
    if (line.startsWith('\\')) continue
    if (line.startsWith('-')) {
      pendingDel.push(line.slice(1))
      continue
    }
    if (line.startsWith('+')) {
      const text = line.slice(1)
      if (pendingDel.length > 0) {
        const old = pendingDel.shift() ?? ''
        leftNo += 1
        rightNo += 1
        rows.push({ leftNo, rightNo, left: old, right: text, kind: 'replace' })
      } else {
        rightNo += 1
        rows.push({ leftNo: null, rightNo, left: '', right: text, kind: 'add' })
      }
      continue
    }
    flushDel()
    const text = line.startsWith(' ') ? line.slice(1) : line
    leftNo += 1
    rightNo += 1
    rows.push({ leftNo, rightNo, left: text, right: text, kind: 'ctx' })
  }
  flushDel()
  return rows
}
