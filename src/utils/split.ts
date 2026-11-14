import type { Expense, ExpenseShare, ExpenseSplit } from '../types/Finance'
import type { Settlement } from '../types/Settlement'

/** Converte reais em centavos inteiros, sem erro de ponto flutuante. */
export function toCents(value: number): number {
  return Math.round(value * 100)
}

/** Converte centavos inteiros em reais com duas casas. */
export function fromCents(value: number): number {
  return Math.round(value) / 100
}

/**
 * Divide um total igualmente entre os uids recebidos, em centavos.
 * O resto vai um centavo por vez para os primeiros da ordem recebida.
 * Devolve {} quando o total é inválido ou alguma parte ficaria zero.
 */
export function splitEvenly(total: number, memberUids: string[]): Record<string, number> {
  const totalCents = toCents(total)
  if (!memberUids.length || totalCents <= 0 || totalCents < memberUids.length) return {}

  const base = Math.floor(totalCents / memberUids.length)
  const remainder = totalCents - base * memberUids.length
  const result: Record<string, number> = {}

  memberUids.forEach((uid, index) => {
    result[uid] = fromCents(base + (index < remainder ? 1 : 0))
  })

  return result
}

export type SplitValidation = { valid: true } | { valid: false; message: string }

/**
 * Valida a divisão antes de gravar.
 * `name`/`email` são apenas instantâneos visuais e não entram na validação.
 */
export function validateExpenseSplit(
  total: number,
  split: ExpenseSplit,
  allowedMemberUids: string[],
): SplitValidation {
  if (!Number.isFinite(total) || toCents(total) <= 0) {
    return { valid: false, message: 'O valor do gasto precisa ser maior que zero.' }
  }

  const allowed = new Set(allowedMemberUids)
  const paidByUid = typeof split?.paidByUid === 'string' ? split.paidByUid.trim() : ''

  if (!paidByUid) {
    return { valid: false, message: 'Informe quem pagou o gasto.' }
  }

  if (!allowed.has(paidByUid)) {
    return { valid: false, message: 'Quem pagou precisa ser membro do espaço.' }
  }

  const shares = Array.isArray(split.shares) ? split.shares : []
  const shareUids = shares.map((share) =>
    share && typeof share.uid === 'string' ? share.uid.trim() : '',
  )

  if (!shareUids.includes(paidByUid)) {
    return { valid: false, message: 'Quem pagou precisa participar da divisão.' }
  }

  if (shares.length < 2) {
    return { valid: false, message: 'Selecione pelo menos 2 participantes.' }
  }

  const seen = new Set<string>()

  for (const [index, share] of shares.entries()) {
    const uid = shareUids[index]

    if (!uid || !allowed.has(uid)) {
      return { valid: false, message: 'Todos os participantes precisam ser membros do espaço.' }
    }

    if (seen.has(uid)) {
      return { valid: false, message: 'Um membro não pode aparecer mais de uma vez na divisão.' }
    }

    seen.add(uid)

    if (!Number.isFinite(share.amount) || toCents(share.amount) <= 0) {
      return { valid: false, message: 'Cada participante precisa ter um valor maior que zero.' }
    }
  }

  const sumCents = shares.reduce((sum, share) => sum + toCents(share.amount), 0)

  if (sumCents !== toCents(total)) {
    return { valid: false, message: 'A soma das partes precisa ser igual ao total do gasto.' }
  }

  return { valid: true }
}

/** Rótulo de exibição do participante: nome, senão e-mail, senão "Membro". */
export function splitMemberLabel(share: ExpenseShare): string {
  const name = typeof share?.name === 'string' ? share.name.trim() : ''
  if (name) return name

  const email = typeof share?.email === 'string' ? share.email.trim() : ''
  if (email) return email

  return 'Membro'
}

// ---------- Saldos e acertos (V6.0 Lote 2) ----------

export type SplitStatus = 'pending' | 'partial' | 'paid'

export interface ShareBalance {
  uid: string
  name?: string
  email?: string
  due: number
  received: number
  pending: number
  status: SplitStatus
}

export interface SettlementLine {
  expenseId: string
  description: string
  date: string
  counterpartUid: string
  counterpartName?: string
  counterpartEmail?: string
  paidByUid: string
  due: number
  received: number
  pending: number
  status: SplitStatus
}

/** Status derivado; nunca é persistido. */
export function splitStatus(due: number, received: number): SplitStatus {
  const dueCents = toCents(due)
  const receivedCents = toCents(received)

  if (receivedCents <= 0) return 'pending'
  if (receivedCents >= dueCents) return 'paid'
  return 'partial'
}

export function settlementsForExpense(
  expenseId: string,
  settlements: Settlement[],
): Settlement[] {
  return sortSettlements(settlements.filter((settlement) => settlement.expenseId === expenseId))
}

/** Ordem determinística: createdAt crescente e, no empate, id. */
function sortSettlements(settlements: Settlement[]): Settlement[] {
  return [...settlements].sort((a, b) => {
    const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : 0
    const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 0
    if (aTime !== bTime) return aTime - bTime
    return a.id.localeCompare(b.id)
  })
}

function receivedCentsFor(
  expense: Expense,
  fromUid: string,
  settlements: Settlement[],
): number {
  const paidByUid = expense.split?.paidByUid
  if (!paidByUid) return 0

  return settlements.reduce((sum, settlement) => {
    if (
      settlement.expenseId !== expense.id ||
      settlement.fromUid !== fromUid ||
      settlement.toUid !== paidByUid
    ) {
      return sum
    }
    return sum + toCents(settlement.amount)
  }, 0)
}

/** Saldo de cada participante do gasto, incluindo a parte do pagador. */
export function shareBalances(expense: Expense, settlements: Settlement[]): ShareBalance[] {
  if (!expense.split) return []

  return expense.split.shares.map((share) => {
    const dueCents = toCents(share.amount)
    const receivedCents = receivedCentsFor(expense, share.uid, settlements)
    const pendingCents = Math.max(dueCents - receivedCents, 0)
    const due = fromCents(dueCents)
    const received = fromCents(receivedCents)

    return {
      uid: share.uid,
      ...(share.name ? { name: share.name } : {}),
      ...(share.email ? { email: share.email } : {}),
      due,
      received,
      pending: fromCents(pendingCents),
      status: splitStatus(due, received),
    }
  })
}

/** Quanto ainda falta para uma parte específica. */
export function remainingForShare(
  expense: Expense,
  fromUid: string,
  settlements: Settlement[],
): number {
  if (!expense.split || fromUid === expense.split.paidByUid) return 0

  const share = expense.split.shares.find((item) => item.uid === fromUid)
  if (!share) return 0

  const pendingCents = Math.max(
    toCents(share.amount) - receivedCentsFor(expense, fromUid, settlements),
    0,
  )

  return fromCents(pendingCents)
}

function lineFor(
  expense: Expense,
  share: ExpenseShare,
  counterpart: { uid: string; name?: string; email?: string },
  settlements: Settlement[],
): SettlementLine {
  const dueCents = toCents(share.amount)
  const receivedCents = receivedCentsFor(expense, share.uid, settlements)
  const pendingCents = Math.max(dueCents - receivedCents, 0)
  const due = fromCents(dueCents)
  const received = fromCents(receivedCents)
  const name = counterpart.name?.trim() ?? ''
  const email = counterpart.email?.trim() ?? ''

  return {
    expenseId: expense.id,
    description: expense.description,
    date: expense.date,
    counterpartUid: counterpart.uid,
    ...(name ? { counterpartName: name } : {}),
    ...(email ? { counterpartEmail: email } : {}),
    paidByUid: expense.split?.paidByUid ?? '',
    due,
    received,
    pending: fromCents(pendingCents),
    status: splitStatus(due, received),
  }
}

/**
 * Compara duas divisões ignorando a ordem das partes.
 * Utilizada pela trava de gastos para permitir apenas edições cosméticas
 * quando houver acertos vinculados.
 */
export function areSplitsEqual(a?: ExpenseSplit, b?: ExpenseSplit): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  if (a.paidByUid !== b.paidByUid) return false
  if (a.shares.length !== b.shares.length) return false

  for (const aShare of a.shares) {
    const bShare = b.shares.find((item) => item.uid === aShare.uid)
    if (!bShare) return false
    if (toCents(aShare.amount) !== toCents(bShare.amount)) return false
  }

  return true
}

function sortLines(lines: SettlementLine[]): SettlementLine[] {
  return lines.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date)
    if (a.description !== b.description) {
      return a.description.localeCompare(b.description, 'pt-BR')
    }
    return a.counterpartUid.localeCompare(b.counterpartUid)
  })
}

/** Linhas que o pagador tem a receber (a parte dos demais participantes). */
export function receivablesFor(
  uid: string,
  expenses: Expense[],
  settlements: Settlement[],
): SettlementLine[] {
  const lines: SettlementLine[] = []

  expenses.forEach((expense) => {
    const split = expense.split
    if (!split || split.paidByUid !== uid) return

    split.shares.forEach((share) => {
      if (share.uid === uid) return
      lines.push(lineFor(expense, share, share, settlements))
    })
  })

  return sortLines(lines)
}

/** Linhas que o participante tem a pagar ao pagador do gasto. */
export function payablesFor(
  uid: string,
  expenses: Expense[],
  settlements: Settlement[],
): SettlementLine[] {
  const lines: SettlementLine[] = []

  expenses.forEach((expense) => {
    const split = expense.split
    if (!split || split.paidByUid === uid) return

    const ownShare = split.shares.find((share) => share.uid === uid)
    if (!ownShare) return

    const payer = split.shares.find((share) => share.uid === split.paidByUid)
    lines.push(lineFor(expense, ownShare, payer ?? { uid: split.paidByUid }, settlements))
  })

  return sortLines(lines)
}
