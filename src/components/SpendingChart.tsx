import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Transaction } from '../types/Transaction'
import { formatCurrency } from '../utils/currency'
import { formatDate } from '../utils/dates'

interface SpendingChartProps { transactions: Transaction[] }

export function SpendingChart({ transactions }: SpendingChartProps) {
  const totals = new Map<string, number>()
  transactions.filter((item) => ['purchase', 'installment', 'pix_credit'].includes(item.type) && item.amount > 0)
    .forEach((item) => totals.set(item.date, (totals.get(item.date) ?? 0) + item.amount))
  const data = [...totals.entries()].map(([date, value]) => ({ date, label: formatDate(date).slice(0, 5), value })).sort((a, b) => a.date.localeCompare(b.date))

  return <article className="panel chart-panel">
    <div className="panel-heading"><div><span className="eyebrow">Linha do tempo</span><h2>Gastos por dia</h2></div></div>
    {!data.length ? <div className="empty-mini">Importe uma fatura para visualizar.</div> : <div className="bar-wrap"><ResponsiveContainer width="100%" height={285}>
      <BarChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e4f0" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} /><YAxis tickLine={false} axisLine={false} fontSize={11} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
        <Tooltip formatter={(value) => formatCurrency(Number(value))} labelFormatter={(label) => `Data: ${label}`} /><Bar dataKey="value" name="Gastos" fill="#6d28d9" radius={[7, 7, 0, 0]} /></BarChart>
    </ResponsiveContainer></div>}
  </article>
}
