import type { InstallmentInfo, TransactionType } from '../types/Transaction'

export function extractInstallment(title: string): InstallmentInfo | undefined {
  const match = /(?:parcela\s*)?(\d{1,2})\s*\/\s*(\d{1,2})/i.exec(title)
  if (!match) return undefined

  const current = Number(match[1])
  const total = Number(match[2])

  if (!current || !total || current > total) return undefined
  return { current, total }
}

export function cleanInstallmentTitle(title: string): string {
  return title
    .replace(/\s*-?\s*parcela\s*\d{1,2}\s*\/\s*\d{1,2}\s*/i, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function classifyTransaction(title: string, amount: number): TransactionType {
  const normalized = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  if (/pagamento recebido|pagamento de fatura/.test(normalized)) return 'payment'
  if (/estorno|credito de compra|cancelamento/.test(normalized)) return 'refund'
  if (/pix no credito/.test(normalized)) return 'pix_credit'
  if (extractInstallment(title)) return 'installment'
  if (amount > 0) return 'purchase'
  return 'other'
}

export const TYPE_LABELS: Record<TransactionType, string> = {
  purchase: 'Compra',
  installment: 'Parcelado',
  pix_credit: 'Pix no Crédito',
  payment: 'Pagamento',
  refund: 'Estorno',
  other: 'Outro',
}
