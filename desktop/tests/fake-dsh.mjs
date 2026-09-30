const mode = process.argv[2]
if (mode !== 'timeout') {
  // Split writes exercise readiness parsing across chunks.
  process.stdout.write('dsh web: http://127.0.0.1:43210/?token=')
  setTimeout(() => process.stdout.write(`test-${process.pid}\n`), 25)
}
setInterval(() => {}, 1000)
if (mode === 'crash') setTimeout(() => process.exit(1), 80)
