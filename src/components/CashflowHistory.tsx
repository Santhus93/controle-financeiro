import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Wallet } from 'lucide-react'
import { formatCurrency } from '../utils/currency'
import { formatMonthLabel } from '../utils/invoiceReference'
import { computeMonthSummary, monthsWithData, type FinanceData } from '../utils/monthPlan'

interface CashflowHistoryProps {
  data: FinanceData
}

function formatAxis(value: number): string {
  if (Math.abs(value) < 1000) return String(Math.round(value))
  return `${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`
}

/** Histórico do mês completo: receitas, cartão, contas fixas, avulsos e sobra. */
export function CashflowHistory({ data }: CashflowHistoryProps) {
  const months = monthsWithData(data)
  const rows = months.map((month) => ({
    ...computeMonthSummary(month, data),
    label: formatMonthLabel(month, 'short'),
  }))

  if (!rows.length) {
    return (
      <section className="panel history-empty">
        <Wallet size={26} />
        <strong>Sem dados do mês completo ainda</strong>
        <span>Cadastre receitas e contas fixas para acompanhar a sobra mês a mês.</span>
      </section>
    )
  }

  const withIncome = rows.filter((row) => row.income > 0)
  const averageLeftover = withIncome.length
    ? withIncome.reduce((sum, row) => sum + row.leftover, 0) / withIncome.length
    : null
  const best = withIncome.length
    ? withIncome.reduce((max, row) => (row.leftover > max.leftover ? row : max))
    : null
  const worst = withIncome.length
    ? withIncome.reduce((min, row) => (row.leftover < min.leftover ? row : min))
    : null
  const averageOutflow = rows.reduce((sum, row) => sum + row.outflow, 0) / rows.length

  return (
    <div className="history-view cashflow-history">
      <section className="summary-grid history-kpis">
        <article className="stat-card blue">
          <div className="stat-top"><span>Sobra média</span></div>
          <strong>{averageLeftover === null ? '—' : formatCurrency(averageLeftover)}</strong>
          <small>{withIncome.length} mês(es) com receita</small>
        </article>
        <article className="stat-card green">
          <div className="stat-top"><span>Melhor mês</span></div>
          <strong>{best ? formatCurrency(best.leftover) : '—'}</strong>
          <small>{best ? formatMonthLabel(best.month) : 'Cadastre receitas'}</small>
        </article>
        <article className="stat-card danger">
          <div className="stat-top"><span>Pior mês</span></div>
          <strong>{worst ? formatCurrency(worst.leftover) : '—'}</strong>
          <small>{worst ? formatMonthLabel(worst.month) : 'Cadastre receitas'}</small>
        </article>
        <article className="stat-card orange">
          <div className="stat-top"><span>Saídas médias</span></div>
          <strong>{formatCurrency(averageOutflow)}</strong>
          <small>Cartão + contas + avulsos</small>
        </article>
      </section>

      <section className="panel history-chart">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Mês completo</span>
            <h2>Entradas, saídas e sobra</h2>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={rows} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e4f0" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis width={44} tickLine={false} axisLine={false} fontSize={11} tickFormatter={(value) => formatAxis(Number(value))} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="income" name="Receitas" fill="#16a34a" radius={[6, 6, 0, 0]} maxBarSize={34} />
            <Bar dataKey="card" name="Cartão" stackId="out" fill="#6d28d9" maxBarSize={34} />
            <Bar dataKey="bills" name="Contas fixas" stackId="out" fill="#ea580c" maxBarSize={34} />
            <Bar dataKey="expenses" name="Avulsos" stackId="out" fill="#db2777" radius={[6, 6, 0, 0]} maxBarSize={34} />
            <Line dataKey="leftover" name="Sobra" type="monotone" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Detalhamento</span>
            <h2>Mês a mês</h2>
          </div>
        </div>
        <div className="table-scroll">
          <table className="cashflow-table">
            <thead>
              <tr>
                <th>Mês</th>
                <th className="money">Receitas</th>
                <th className="money">Cartão</th>
                <th className="money">Contas</th>
                <th className="money">Avulsos</th>
                <th className="money">Sobra</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((row) => (
                <tr key={row.month}>
                  <td><strong className="merchant month-cell">{formatMonthLabel(row.month)}</strong></td>
                  <td className="money positive-text">{formatCurrency(row.income)}</td>
                  <td className="money">{formatCurrency(row.card)}</td>
                  <td className="money">{formatCurrency(row.bills)}</td>
                  <td className="money">{formatCurrency(row.expenses)}</td>
                  <td className={`money ${row.leftover >= 0 ? 'diff-down' : 'diff-up'}`}>{formatCurrency(row.leftover)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="section-divider">
        <span>Análise do cartão</span>
      </div>
    </div>
  )
}
