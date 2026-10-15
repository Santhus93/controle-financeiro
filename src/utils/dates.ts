export function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(value: string): string {
  const date = parseIsoDate(value)
  return date
    ? new Intl.DateTimeFormat('pt-BR').format(date)
    : value
}

export function formatMonthReference(transactions: { date: string }[]): string {
  const dates = transactions
    .map((item) => parseIsoDate(item.date))
    .filter((date): date is Date => Boolean(date))

  if (!dates.length) return 'Fatura importada'

  const latest = new Date(Math.max(...dates.map((date) => date.getTime())))
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(latest)
}
