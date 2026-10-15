import type { Transaction } from './Transaction'

export interface InvoiceSummary {
  id: string
  referenceMonth: string
  fileName: string
  card: string
  transactionCount: number
  totalExpenses: number
  totalRefunds: number
  totalPayments: number
  importedAt: Date | null
}

export interface SavedInvoice extends InvoiceSummary {
  transactions: Transaction[]
}

export interface SaveInvoiceResult {
  invoice: SavedInvoice
  alreadyExisted: boolean
}
