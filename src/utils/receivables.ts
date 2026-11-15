import type { Receivable, ReceivablePayment } from '../types/Receivable'
import type { Transaction, TransactionType } from '../types/Transaction'
import { todayIso } from './monthPlan'
import { fromCents, toCents } from './split'

export type ReceivableStatus = 'pending' | 'partial' | 'paid' | 'overdue'

export const RECEIVABLE_STATUS_LABELS: Record<ReceivableStatus, string> = {
  pending: 'Pendente',
  partial: 'Parcial',
  paid: 'Pago',
  overdue: 'Atrasada',
}

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

/** Tipos de lançamento do cartão que representam gasto real e podem ser cobrados. */
const CHARGEABLE_TRANSACTION_TYPES: readonly TransactionType[] = [
  'purchase',
  'installment',
  'pix_credit',
]

/**
 * Elegibilidade de uma transação do cartão para gerar uma cobrança.
 * Só gasto real positivo: purchase, installment e pix_credit com amount > 0.
 */
export function canCreateReceivableFromTransaction(transaction: Transaction): boolean {
  return (
    CHARGEABLE_TRANSACTION_TYPES.includes(transaction.type) &&
    toCents(transaction.amount) > 0
  )
}

/**
 * Cobrança ligada a uma transação da fatura.
 * Compara `invoiceId + transactionId` apenas em cobranças de cartão.
 */
export function findReceivableByTransaction(
  receivables: Receivable[],
  invoiceId: string,
  transactionId: string,
): Receivable | undefined {
  const invoice = invoiceId.trim()
  const transaction = transactionId.trim()
  if (!invoice || !transaction) return undefined

  return receivables.find(
    (receivable) =>
      receivable.source.type === 'card_transaction' &&
      receivable.source.invoiceId === invoice &&
      receivable.source.transactionId === transaction,
  )
}

/** Atalho booleano para a unicidade por `invoiceId + transactionId`. */
export function hasReceivableForTransaction(
  receivables: Receivable[],
  invoiceId: string,
  transactionId: string,
): boolean {
  return Boolean(findReceivableByTransaction(receivables, invoiceId, transactionId))
}

/** Valida o vínculo obrigatório da origem `card_transaction`. */
export function validateCardReceivableSource(
  invoiceId: string,
  transactionId: string,
): string | null {
  if (!invoiceId.trim()) return 'A fatura do lançamento não foi identificada.'
  if (!transactionId.trim()) return 'O lançamento do cartão não foi identificado.'
  return null
}

/**
 * O valor cobrado pode ser parcial, mas nunca maior que a transação.
 * Trabalha em centavos para não aceitar diferença de ponto flutuante.
 */
export function validateCardReceivableAmount(
  transactionAmount: number,
  amount: number,
): string | null {
  const limitCents = toCents(transactionAmount)
  const amountCents = toCents(amount)

  if (!Number.isFinite(amount) || amountCents <= 0) {
    return 'O valor a cobrar precisa ser maior que zero.'
  }

  if (amountCents > limitCents) {
    return 'O valor a cobrar não pode ser maior que o lançamento do cartão.'
  }

  return null
}
