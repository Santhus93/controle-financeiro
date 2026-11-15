import type { Receivable, ReceivablePayment } from '../types/Receivable'
import { todayIso } from './monthPlan'
import { fromCents, toCents } from './split'

export type ReceivableStatus = 'pending' | 'partial' | 'paid' | 'overdue'

export interface ReceivableBalance {
  receivableId: string
  due: number
  received: number
  pending: number
  status: ReceivableStatus
}

export interface ReceivableTotals {
  due: number
  received: number
  pending: number
}

/**
 * Ordem determinística: vencimento crescente (sem vencimento por último),
 * depois pessoa e id.
 */
export function sortReceivables(receivables: Receivable[]): Receivable[] {
  return [...receivables].sort((a, b) => {
    const aDue = a.dueDate ?? ''
    const bDue = b.dueDate ?? ''
    if (aDue !== bDue) {
      if (!aDue) return 1
      if (!bDue) return -1
      return aDue.localeCompare(bDue)
    }
    const byName = a.contact.name.localeCompare(b.contact.name, 'pt-BR')
    return byName !== 0 ? byName : a.id.localeCompare(b.id)
  })
}

/** Pagamentos de uma cobrança, em ordem determinística (data, criação e id). */
export function receivablePaymentsFor(
  receivableId: string,
  payments: ReceivablePayment[],
): ReceivablePayment[] {
  return payments
    .filter((payment) => payment.receivableId === receivableId)
    .sort((a, b) => {
      if (a.paymentDate !== b.paymentDate) return a.paymentDate.localeCompare(b.paymentDate)

      const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : 0
      const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 0
      if (aTime !== bTime) return aTime - bTime

      return a.id.localeCompare(b.id)
    })
}

/**
 * Saldo derivado de uma cobrança. Nunca é persistido.
 * Prioridade do status: pago > atrasado > parcial > pendente.
 */
export function receivableBalance(
  receivable: Receivable,
  payments: ReceivablePayment[],
  today: string = todayIso(),
): ReceivableBalance {
  const dueCents = toCents(receivable.amount)
  const receivedCents = receivablePaymentsFor(receivable.id, payments).reduce(
    (sum, payment) => sum + toCents(payment.amount),
    0,
  )
  const pendingCents = Math.max(dueCents - receivedCents, 0)

  let status: ReceivableStatus

  if (pendingCents <= 0) {
    status = 'paid'
  } else if (receivable.dueDate && receivable.dueDate < today) {
    status = 'overdue'
  } else if (receivedCents > 0) {
    status = 'partial'
  } else {
    status = 'pending'
  }

  return {
    receivableId: receivable.id,
    due: fromCents(dueCents),
    received: fromCents(receivedCents),
    pending: fromCents(pendingCents),
    status,
  }
}

/**
 * Totais consolidados em centavos.
 * Pagamento órfão (sem cobrança correspondente) não entra em nenhum total.
 */
export function totalReceivableBalance(
  receivables: Receivable[],
  payments: ReceivablePayment[],
  today: string = todayIso(),
): ReceivableTotals {
  let dueCents = 0
  let receivedCents = 0
  let pendingCents = 0

  receivables.forEach((receivable) => {
    const balance = receivableBalance(receivable, payments, today)
    dueCents += toCents(balance.due)
    receivedCents += toCents(balance.received)
    pendingCents += toCents(balance.pending)
  })

  return {
    due: fromCents(dueCents),
    received: fromCents(receivedCents),
    pending: fromCents(pendingCents),
  }
}
