export function buildDateRange(days = 30) {
  const to = new Date()
  const from = new Date(to)
  from.setDate(to.getDate() - Math.max(1, Number(days) - 1))

  const fmt = (d) => d.toISOString().slice(0, 10)
  return { from: fmt(from), to: fmt(to) }
}
