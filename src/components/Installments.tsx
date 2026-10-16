import { CalendarClock, TrendingDown } from 'lucide-react'
import type { Transaction } from '../types/Transaction'
import { formatCurrency } from '../utils/currency'
import { addMonths, formatMonthLabel } from '../utils/invoiceReference'

interface InstallmentsProps {
  transactions: Transaction[]
  invoiceMonth: string
}

export function Installments({ transactions, invoiceMonth }: InstallmentsProps) {
  const installments = transactions.filter((item) => item.installment && item.amount > 0)

  // Projeção: cada parcela restante cai nas próximas faturas, uma por mês.
  const projection = new Map<string, number>()
  installments.forEach((item) => {
    const remaining = Math.max((item.installment?.total ?? 0) - (item.installment?.current ?? 0), 0)
    for (let step = 1; step <= remaining; step += 1) {
      const month = addMonths(invoiceMonth, step)
      projection.set(month, (projection.get(month) ?? 0) + item.amount)
    }
  })

  const months = [...projection.entries()].sort(([a], [b]) => a.localeCompare(b))
  const futureCommitment = months.reduce((sum, [, value]) => sum + value, 0)
  const maxMonth = Math.max(...months.map(([, value]) => value), 1)

  return (
    <section className="panel installments-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Planejamento</span>
          <h2>Parcelamentos e compromissos futuros</h2>
        </div>
        <div className="commitment">
          <span>Já comprometido nas próximas faturas</span>
          <strong>{formatCurrency(futureCommitment)}</strong>
        </div>
      </div>

      {!installments.length ? (
        <div className="empty-mini">Nenhum parcelamento explícito foi encontrado nesta fatura.</div>
      ) : (
        <div className="installments-layout">
          <div className="installment-grid">
            {installments.map((item) => {
              const current = item.installment?.current ?? 0
              const total = item.installment?.total ?? 0
              const remaining = Math.max(total - current, 0)
              const progress = total ? Math.round((current / total) * 100) : 0
              const lastMonth = addMonths(invoiceMonth, remaining)

              return (
                <article className="installment-card" key={item.id}>
                  <div className="installment-icon"><CalendarClock /></div>
                  <div className="installment-body">
                    <h3>{item.title}</h3>
                    <p>Parcela {current} de {total} · {remaining} restante(s)</p>
                    <div className="installment-progress"><span style={{ width: `${progress}%` }} /></div>
                    <strong>{formatCurrency(item.amount)} por parcela</strong>
                    <small>
                      Saldo projetado: {formatCurrency(remaining * item.amount)}
                      {remaining > 0 && ` · termina em ${formatMonthLabel(lastMonth)}`}
                    </small>
                  </div>
                </article>
              )
            })}
          </div>

          <div className="projection">
            <div className="projection-title"><TrendingDown size={16} /> Projeção por fatura</div>
            {!months.length ? (
              <div className="projection-empty">Todos os parcelamentos terminam nesta fatura.</div>
            ) : (
              months.map(([month, value]) => (
                <div className="projection-row" key={month}>
                  <span className="projection-month">{formatMonthLabel(month, 'short')}</span>
                  <div className="projection-bar"><span style={{ width: `${(value / maxMonth) * 100}%` }} /></div>
                  <strong>{formatCurrency(value)}</strong>
                </div>
              ))
            )}
            <small className="projection-note">
              Estimativa baseada nas parcelas desta fatura. Novas compras parceladas não estão incluídas.
            </small>
          </div>
        </div>
      )}
    </section>
  )
}
