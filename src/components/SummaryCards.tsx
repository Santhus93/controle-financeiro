import { ArrowDownToLine, CreditCard, ReceiptText, RotateCcw, TrendingUp } from 'lucide-react'
import type { Transaction } from '../types/Transaction'
import { formatCurrency } from '../utils/currency'

interface SummaryCardsProps { transactions: Transaction[] }

export function SummaryCards({ transactions }: SummaryCardsProps) {
  const expenses = transactions.filter((item) => ['purchase', 'installment', 'pix_credit'].includes(item.type) && item.amount > 0)
  const totalSpent = expenses.reduce((sum, item) => sum + item.amount, 0)
  const largest = expenses.reduce((max, item) => Math.max(max, item.amount), 0)
  const refunds = Math.abs(transactions.filter((item) => item.type === 'refund').reduce((sum, item) => sum + item.amount, 0))
  const payments = Math.abs(transactions.filter((item) => item.type === 'payment').reduce((sum, item) => sum + item.amount, 0))

  const cards = [
    { label: 'Gastos', value: formatCurrency(totalSpent), foot: `${expenses.length} compras consideradas`, icon: CreditCard, tone: 'purple' },
    { label: 'Maior compra', value: formatCurrency(largest), foot: 'Maior lançamento de despesa', icon: TrendingUp, tone: 'orange' },
    { label: 'Estornos', value: formatCurrency(refunds), foot: 'Créditos identificados', icon: RotateCcw, tone: 'green' },
    { label: 'Pagamento', value: formatCurrency(payments), foot: 'Pagamento recebido', icon: ArrowDownToLine, tone: 'blue' },
    { label: 'Lançamentos', value: String(transactions.length), foot: 'Registros válidos importados', icon: ReceiptText, tone: 'slate' },
  ]

  return <section className="summary-grid">{cards.map(({ icon: Icon, ...card }) => (
    <article className={`stat-card ${card.tone}`} key={card.label}>
      <div className="stat-top"><span>{card.label}</span><Icon size={18} /></div>
      <strong>{card.value}</strong><small>{card.foot}</small>
    </article>
  ))}</section>
}
