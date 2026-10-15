import { CalendarClock } from 'lucide-react'
import type { Transaction } from '../types/Transaction'
import { formatCurrency } from '../utils/currency'

interface InstallmentsProps { transactions: Transaction[] }

export function Installments({ transactions }: InstallmentsProps) {
  const installments = transactions.filter((item) => item.installment)
  const futureCommitment = installments.reduce((sum, item) => {
    const remaining = Math.max((item.installment?.total ?? 0) - (item.installment?.current ?? 0), 0)
    return sum + remaining * item.amount
  }, 0)

  return <section className="panel installments-panel">
    <div className="panel-heading"><div><span className="eyebrow">Planejamento</span><h2>Parcelamentos identificados</h2></div><div className="commitment"><span>Comprometimento estimado</span><strong>{formatCurrency(futureCommitment)}</strong></div></div>
    {!installments.length ? <div className="empty-mini">Nenhum parcelamento explícito foi encontrado.</div> : <div className="installment-grid">{installments.map((item) => {
      const current = item.installment?.current ?? 0
      const total = item.installment?.total ?? 0
      const remaining = Math.max(total - current, 0)
      return <article className="installment-card" key={item.id}><div className="installment-icon"><CalendarClock /></div><div><h3>{item.title}</h3><p>Parcela {current} de {total} · {remaining} restante(s)</p><strong>{formatCurrency(item.amount)} por parcela</strong><small>Saldo projetado: {formatCurrency(remaining * item.amount)}</small></div></article>
    })}</div>}
  </section>
}
