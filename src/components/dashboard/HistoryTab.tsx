import { lazy, Suspense } from 'react'
import { SkeletonCards, SkeletonPanel } from '../Skeleton'
import type { SavedInvoice } from '../../types/Invoice'
import type { FinanceData } from '../../utils/monthPlan'

// Componentes com gráficos (Recharts) só são baixados quando aparecem na tela.
const HistoryView = lazy(() =>
  import('../HistoryView').then((module) => ({ default: module.HistoryView })),
)
const CashflowHistory = lazy(() =>
  import('../CashflowHistory').then((module) => ({ default: module.CashflowHistory })),
)

interface HistoryTabProps {
  data: FinanceData
  allInvoices: SavedInvoice[] | null
}

export function HistoryTab({ data, allInvoices }: HistoryTabProps) {
  return (
    <Suspense
      fallback={
        <>
          <SkeletonCards count={4} />
          <SkeletonPanel chart />
        </>
      }
    >
      <CashflowHistory data={data} />
      {allInvoices === null ? (
        <>
          <SkeletonCards count={4} />
          <SkeletonPanel chart />
        </>
      ) : (
        <HistoryView invoices={allInvoices} />
      )}
    </Suspense>
  )
}
