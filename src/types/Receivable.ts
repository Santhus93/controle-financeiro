import type { Authorship } from './Author'

/**
 * Origem da cobrança.
 * `card_transaction` será usado no Lote 2 (transação do cartão); neste lote
 * apenas `manual` é aceito na criação.
 */
export type ReceivableSourceType = 'manual' | 'card_transaction'

/** Snapshot do contato cobrado. Não é um usuário autenticado. */
export interface ReceivableContact {
  name: string
  email?: string
  phone?: string
}

export interface ReceivableSource {
  type: ReceivableSourceType
  invoiceId?: string
  transactionId?: string
}

/**
 * Valor a receber (cobrança manual).
 * Não é receita: devido, recebido e pendente são sempre derivados dos
 * `ReceivablePayment`. Nada aqui entra no Meu mês, na previsão ou na sobra.
 */
export interface Receivable extends Authorship {
  id: string
  description: string
  contact: ReceivableContact
  amount: number
  /** AAAA-MM-DD */
  dueDate?: string
  notes?: string
  source: ReceivableSource
}

export type NewReceivable = Omit<Receivable, 'id' | keyof Authorship | 'source'> & {
  id?: string
  source?: ReceivableSource
}

/** Recebimento de uma cobrança. Imutável: correção é excluir e registrar de novo. */
export interface ReceivablePayment extends Authorship {
  id: string
  receivableId: string
  amount: number
  /** AAAA-MM-DD */
  paymentDate: string
  notes?: string
}

export type NewReceivablePayment = Omit<ReceivablePayment, 'id' | keyof Authorship> & {
  id?: string
}
