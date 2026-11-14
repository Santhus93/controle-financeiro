import type { Authorship } from './Author'

/**
 * Acerto entre membros de um gasto avulso dividido.
 * Não é receita, despesa nem transação: é só o controle do valor devido.
 */
export interface Settlement extends Authorship {
  id: string
  /** Gasto dividido ao qual o acerto pertence. */
  expenseId: string
  /** Quem está acertando a própria parte. */
  fromUid: string
  /** Quem recebeu: sempre o `paidByUid` do `ExpenseSplit`. */
  toUid: string
  amount: number
}

export type NewSettlement = Omit<Settlement, 'id' | keyof Authorship> & { id?: string }
