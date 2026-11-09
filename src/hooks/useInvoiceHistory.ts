import { useEffect, useState } from 'react'
import type { View } from '../components/dashboard/ViewTabs'
import { loadAllInvoices } from '../services/firestoreService'
import type { InvoiceSummary, SavedInvoice } from '../types/Invoice'
import type { Transaction } from '../types/Transaction'

interface UseInvoiceHistoryParams {
  user: { uid: string } | null
  root: string
  invoices: InvoiceSummary[]
  transactions: Transaction[]
  view: View
  cloudLoading: boolean
  onError: (cause: unknown) => void
}

/**
 * Faturas completas (com lançamentos), usadas na previsão e no histórico.
 * Qualquer alteração em faturas, categorias ou troca de root invalida a cópia.
 */
export function useInvoiceHistory({
  user,
  root,
  invoices,
  transactions,
  view,
  cloudLoading,
  onError,
}: UseInvoiceHistoryParams) {
  const [allInvoices, setAllInvoices] = useState<SavedInvoice[] | null>(null)

  // Invalida ao trocar de fatura/transações OU ao trocar de root (espaço)
  useEffect(() => {
    setAllInvoices(null)
  }, [invoices, transactions, root])

  useEffect(() => {
    if (!user || !root || cloudLoading || allInvoices !== null) return
    if (view !== 'month' && view !== 'history') return

    let cancelled = false

    loadAllInvoices(root)
      .then((data) => {
        if (!cancelled) setAllInvoices(data)
      })
      .catch((cause) => {
        if (!cancelled) onError(cause)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, root, view, allInvoices, cloudLoading])

  return { allInvoices, setAllInvoices }
}
