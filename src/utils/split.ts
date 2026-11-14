import type { ExpenseShare, ExpenseSplit } from '../types/Finance'

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
