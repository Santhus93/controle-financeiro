export const TRANSACTION_CATEGORIES = [
  'Alimentação',
  'Supermercado',
  'Transporte',
  'Saúde',
  'Assinaturas',
  'Compras',
  'Lazer',
  'Casa',
  'Educação',
  'Financeiro',
  'Pix / Transferências',
  'Outros',
  'Não categorizado',
] as const

export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number]

export type TransactionType =
  | 'purchase'
  | 'installment'
  | 'pix_credit'
  | 'payment'
  | 'refund'
  | 'other'

export interface InstallmentInfo {
  current: number
  total: number
}

export interface Transaction {
  id: string
  date: string
  title: string
  originalTitle: string
  amount: number
  type: TransactionType
  category: TransactionCategory
  installment?: InstallmentInfo
}

export interface RawNubankRow {
  date?: string
  title?: string
  amount?: string
}
