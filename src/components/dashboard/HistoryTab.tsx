import { lazy, Suspense } from 'react'
import { BarChart3 } from 'lucide-react'
import { SkeletonCards, SkeletonPanel } from '../Skeleton'
import type { SavedInvoice } from '../../types/Invoice'
import type { FinanceData } from '../../utils/monthPlan'
import type { View } from './ViewTabs'

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
  onNavigate?: (view: View) => void
}

export function HistoryTab({ data, allInvoices, onNavigate }: HistoryTabProps) {
  const hasInvoices = (allInvoices !== null ? allInvoices.length > 0 : data.invoices.length > 0)
  const hasBillsOrIncomes = data.bills.length > 0 || data.incomes.length > 0 || data.expenses.length > 0
  const hasAnyData = hasInvoices || hasBillsOrIncomes

  if (!hasAnyData) {
    return (
      <section className="panel history-empty history-tab-empty">
        <div className="history-tab-empty-icon">
          <BarChart3 size={30} />
        </div>
        <strong>Seu histórico aparece aqui</strong>
        <span>
          Acompanhe a evolução das faturas do cartão, receitas, contas e sobra mês a mês.
        </span>
        <div className="history-tab-empty-actions">
          <button
            type="button"
            className="button-primary"
            onClick={() => onNavigate?.('invoice')}
          >
            Importar fatura
          </button>
          <button
            type="button"
            className="history-tab-empty-btn-secondary"
            onClick={() => onNavigate?.('bills')}
          >
            Cadastrar contas e receitas
          </button>
        </div>
      </section>
    )
  }

  return (
    <div className="history-tab">
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
    </div>
  )
}
