/**
 * O Nubank exporta o CSV com o nome Nubank_AAAA-MM-DD.csv,
 * em que a data é o vencimento da fatura. Esse é o mês de referência
 * mais confiável. Se o nome não seguir o padrão, usa o mês informado.
 */
export function getDueDate(fileName: string): string | null {
  const match = /(\d{4})-(\d{2})-(\d{2})/.exec(fileName)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null
}

export function getInvoiceMonth(fileName: string, fallbackMonth: string): string {
  return getDueDate(fileName)?.slice(0, 7) ?? fallbackMonth
}

export function addMonths(month: string, amount: number): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(year, monthNumber - 1 + amount, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function formatMonthLabel(month: string, style: 'long' | 'short' = 'long'): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) return month

  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1)
  return new Intl.DateTimeFormat('pt-BR', {
    month: style,
    year: style === 'long' ? 'numeric' : '2-digit',
  }).format(date)
}

export function formatDueDate(fileName: string): string | null {
  const dueDate = getDueDate(fileName)
  if (!dueDate) return null
  const [year, month, day] = dueDate.split('-')
  return `${day}/${month}/${year}`
}
