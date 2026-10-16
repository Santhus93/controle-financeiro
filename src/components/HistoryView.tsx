import { useMemo } from 'react'
import { ArrowDownRight, ArrowUpRight, CalendarRange, Repeat } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SavedInvoice } from '../types/Invoice'
import type { Transaction } from '../types/Transaction'
import { merchantKey } from '../services/categoryEngine'
import { formatCurrency } from '../utils/currency'
import { formatMonthLabel } from '../utils/invoiceReference'

interface HistoryViewProps {
  invoices: SavedInvoice[]
}

const EXPENSE_TYPES = ['purchase', 'installment', 'pix_credit']

function expenses(transactions: Transaction[]): Transaction[] {
  return transactions.filter((item) => EXPENSE_TYPES.includes(item.type) && item.amount > 0)
}

function sum(items: Transaction[]): number {
  return items.reduce((total, item) => total + item.amount, 0)
}

function variation(current: number, previous: number): number | null {
  if (!previous) return null
  return ((current - previous) / previous) * 100
}

function VariationBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="var-badge neutral">novo</span>
  if (Math.abs(value) < 0.5) return <span className="var-badge neutral">0%</span>

  const up = value > 0
  return (
    <span className={`var-badge ${up ? 'up' : 'down'}`}>
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

export function HistoryView({ invoices }: HistoryViewProps) {
  const months = useMemo(
    () =>
      invoices.map((invoice) => {
        const items = expenses(invoice.transactions)
        const byCategory = new Map<string, number>()
        items.forEach((item) => byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + item.amount))

        return {
          id: invoice.id,
          month: invoice.referenceMonth,
          label: formatMonthLabel(invoice.referenceMonth, 'short'),
          total: sum(items),
          count: items.length,
          byCategory,
          items,
        }
      }),
    [invoices],
  )

  if (!months.length) {
    return (
      <section className="panel history-empty">
        <CalendarRange size={26} />
        <strong>Nenhuma fatura salva</strong>
        <span>Importe faturas para acompanhar a evolução dos seus gastos.</span>
      </section>
    )
  }

  const current = months[months.length - 1]
  const previous = months.length > 1 ? months[months.length - 2] : null
  const average = months.reduce((total, month) => total + month.total, 0) / months.length
  const highest = months.reduce((max, month) => (month.total > max.total ? month : max), months[0])

  // Categorias: matriz categoria x mês, ordenada pelo gasto da fatura mais recente.
  const allCategories = [...new Set(months.flatMap((month) => [...month.byCategory.keys()]))]
  const categoryRows = allCategories
    .map((category) => {
      const values = months.map((month) => month.byCategory.get(category) ?? 0)
      const currentValue = current.byCategory.get(category) ?? 0
      const previousValue = previous?.byCategory.get(category) ?? 0
      return { category, values, currentValue, previousValue }
    })
    .sort((a, b) => b.currentValue - a.currentValue || b.previousValue - a.previousValue)

  // Recorrências: estabelecimentos presentes em 2 ou mais faturas.
  const merchants = new Map<string, { title: string; category: string; months: Set<string>; total: number; count: number }>()
  months.forEach((month) => {
    month.items
      .filter((item) => item.type !== 'installment')
      .forEach((item) => {
        const key = merchantKey(item.originalTitle)
        const entry = merchants.get(key) ?? { title: item.title, category: item.category, months: new Set<string>(), total: 0, count: 0 }
        entry.months.add(month.month)
        entry.total += item.amount
        entry.count += 1
        merchants.set(key, entry)
      })
  })

  const recurring = [...merchants.values()]
    .filter((entry) => entry.months.size >= 2)
    .map((entry) => ({ ...entry, monthlyAverage: entry.total / entry.months.size }))
    .sort((a, b) => b.monthlyAverage - a.monthlyAverage)
    .slice(0, 12)

  const recurringMonthly = recurring.reduce((total, entry) => total + entry.monthlyAverage, 0)

  return (
    <div className="history-view">
      <section className="summary-grid history-kpis">
        <article className="stat-card purple">
          <div className="stat-top"><span>Faturas</span></div>
          <strong>{months.length}</strong>
          <small>{formatMonthLabel(months[0].month)} a {formatMonthLabel(current.month)}</small>
        </article>
        <article className="stat-card blue">
          <div className="stat-top"><span>Média mensal</span></div>
          <strong>{formatCurrency(average)}</strong>
          <small>Gastos por fatura</small>
        </article>
        <article className="stat-card orange">
          <div className="stat-top"><span>Última fatura</span></div>
          <strong>{formatCurrency(current.total)}</strong>
          <small className="kpi-variation">
            {previous ? <>vs anterior <VariationBadge value={variation(current.total, previous.total)} /></> : 'Sem fatura anterior'}
          </small>
        </article>
        <article className="stat-card green">
          <div className="stat-top"><span>Vs média</span></div>
          <strong>{formatCurrency(current.total - average)}</strong>
          <small className="kpi-variation">
            última fatura <VariationBadge value={variation(current.total, average)} />
          </small>
        </article>
        <article className="stat-card slate">
          <div className="stat-top"><span>Maior fatura</span></div>
          <strong>{formatCurrency(highest.total)}</strong>
          <small>{formatMonthLabel(highest.month)}</small>
        </article>
      </section>

      <section className="panel history-chart">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Evolução</span>
            <h2>Gastos por fatura</h2>
          </div>
          <span className="result-count">Linha tracejada = média ({formatCurrency(average)})</span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={months} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e4f0" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis tickLine={false} axisLine={false} fontSize={11} tickFormatter={(value) => `${(Number(value) / 1000).toFixed(1)}k`} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <ReferenceLine y={average} stroke="#ea580c" strokeDasharray="5 5" />
            <Bar dataKey="total" name="Gastos" fill="#6d28d9" radius={[8, 8, 0, 0]} maxBarSize={70} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="panel history-categories">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Comparativo</span>
            <h2>Categorias mês a mês</h2>
          </div>
          {previous && (
            <span className="result-count">
              Variação: {formatMonthLabel(current.month, 'short')} vs {formatMonthLabel(previous.month, 'short')}
            </span>
          )}
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Categoria</th>
                {months.map((month) => (
                  <th key={month.id} className="money">{month.label}</th>
                ))}
                <th className="money">Diferença</th>
                <th className="money">Variação</th>
              </tr>
            </thead>
            <tbody>
              {categoryRows.map((row) => (
                <tr key={row.category}>
                  <td><strong className="merchant">{row.category}</strong></td>
                  {row.values.map((value, index) => (
                    <td key={months[index].id} className="money muted-zero">
                      {value ? formatCurrency(value) : '—'}
                    </td>
                  ))}
                  <td className={`money ${row.currentValue - row.previousValue > 0 ? 'diff-up' : 'diff-down'}`}>
                    {previous ? formatCurrency(row.currentValue - row.previousValue) : '—'}
                  </td>
                  <td className="money">
                    {previous ? <VariationBadge value={variation(row.currentValue, row.previousValue)} /> : '—'}
                  </td>
                </tr>
              ))}
              <tr className="total-row">
                <td><strong>Total</strong></td>
                {months.map((month) => (
                  <td key={month.id} className="money">{formatCurrency(month.total)}</td>
                ))}
                <td className="money">{previous ? formatCurrency(current.total - previous.total) : '—'}</td>
                <td className="money">
                  {previous ? <VariationBadge value={variation(current.total, previous.total)} /> : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel history-recurring">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Padrões</span>
            <h2>Gastos que se repetem</h2>
            <p className="uncat-subtitle">
              Estabelecimentos presentes em 2 ou mais faturas (parcelamentos não entram).
              Com mais meses importados, a identificação fica mais confiável.
            </p>
          </div>
          <div className="commitment">
            <span>Média mensal desses gastos</span>
            <strong>{formatCurrency(recurringMonthly)}</strong>
          </div>
        </div>

        {!recurring.length ? (
          <div className="empty-mini">
            {months.length < 2
              ? 'Importe pelo menos 2 faturas para identificar gastos recorrentes.'
              : 'Nenhum estabelecimento se repetiu entre as faturas.'}
          </div>
        ) : (
          <div className="recurring-grid">
            {recurring.map((entry) => (
              <article className="recurring-card" key={entry.title}>
                <div className="recurring-icon"><Repeat size={16} /></div>
                <div>
                  <strong>{entry.title}</strong>
                  <span>{entry.category} · {entry.months.size} de {months.length} faturas · {entry.count} lançamento(s)</span>
                </div>
                <b>{formatCurrency(entry.monthlyAverage)}<small>/mês</small></b>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
