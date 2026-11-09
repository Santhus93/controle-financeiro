import { useEffect, useState } from 'react'
import type { View } from '../components/dashboard/ViewTabs'
import { loadAllInvoices } from '../services/firestoreService'
import type { InvoiceSummary, SavedInvoice } from '../types/Invoice'
import type { Transaction } from '../types/Transaction'

interface UseInvoiceHistoryParams {
  user: { uid: string } | null
  invoices: InvoiceSummary[]
  transactions: Transaction[]
  view: View
  cloudLoading: boolean
  onError: (cause: unknown) => void
}

/**
 * Faturas completas (com lançamentos), usadas na previsão e no histórico.
 * Qualquer alteração em faturas ou categorias invalida a cópia carregada.
 */
export function useInvoiceHistory({
  user,
  invoices,
  transactions,
  view,
  cloudLoading,
  onError,
}: UseInvoiceHistoryParams) {
  const [allInvoices, setAllInvoices] = useState<SavedInvoice[] | null>(null)

  useEffect(() => {
    setAllInvoices(null)
  }, [invoices, transactions])

  useEffect(() => {
    if (!user || cloudLoading || allInvoices !== null) return
    if (view !== 'month' && view !== 'history') return

    let cancelled = false

    loadAllInvoices(user.uid)
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
  }, [user, view, allInvoices, cloudLoading])

  return { allInvoices, setAllInvoices }
}
