export function parsePtBrCurrency(value: string | number): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0

  const normalized = String(value ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/R\$/gi, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '')

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}
