import type { InstallmentInfo, TransactionType } from '../types/Transaction'

export function extractInstallment(title: string): InstallmentInfo | undefined {
  const match = /(?:parcela\s*)?(\d{1,2})\s*\/\s*(\d{1,2})/i.exec(title)
  if (!match) return undefined

  const current = Number(match[1])
  const total = Number(match[2])

  if (!current || !total || current > total) return undefined
  return { current, total }
}

/** Remove "Parcela 2/5" ou " - 1/2" do final da descrição. */
export function cleanInstallmentTitle(title: string): string {
  return title
    .replace(/\s*-?\s*parcela\s*\d{1,2}\s*\/\s*\d{1,2}\s*/i, ' ')
    .replace(/\s*-\s*\d{1,2}\s*\/\s*\d{1,2}\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalize(title: string): string {
  return title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/**
 * Saldo trazido da fatura anterior. Não é gasto novo: as compras dele
 * já foram contadas no mês anterior. Fica como "Saldo anterior" e não
 * entra nos totais, gráficos nem orçamento.
 */
export function isCarriedBalance(title: string): boolean {
  return /valor pendente|saldo anterior|saldo em atraso|saldo remanescente|fatura anterior/.test(
    normalize(title),
  )
}

export function classifyTransaction(title: string, amount: number): TransactionType {
  const normalized = normalize(title)

  if (/pagamento recebido|pagamento de fatura|pagamento efetuado|pagto fatura|pgto fatura/.test(normalized)) {
    return 'payment'
  }
  if (/estorno|credito de compra|cancelamento|reembolso|devolucao/.test(normalized)) return 'refund'
  if (isCarriedBalance(title)) return 'other'
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
  other: 'Saldo anterior / outro',
}
