import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { Transaction } from '../types/Transaction'
import { formatCurrency } from '../utils/currency'

interface CategoryChartProps { transactions: Transaction[] }
const COLORS = ['#6d28d9', '#2563eb', '#0f766e', '#ea580c', '#db2777', '#7c3aed', '#ca8a04', '#475569', '#16a34a', '#9333ea']

export function CategoryChart({ transactions }: CategoryChartProps) {
  const totals = new Map<string, number>()
  transactions
    .filter((item) => ['purchase', 'installment', 'pix_credit'].includes(item.type) && item.amount > 0)
    .forEach((item) => totals.set(item.category, (totals.get(item.category) ?? 0) + item.amount))

  const data = [...totals.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  return <article className="panel chart-panel">
    <div className="panel-heading"><div><span className="eyebrow">Distribuição</span><h2>Gastos por categoria</h2></div></div>
    {!data.length ? <div className="empty-mini">Importe uma fatura para visualizar.</div> : <div className="chart-layout">
      <div className="pie-wrap"><ResponsiveContainer width="100%" height={250}>
        <PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={96} paddingAngle={2}>
          {data.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}
        </Pie><Tooltip formatter={(value) => formatCurrency(Number(value))} /></PieChart>
      </ResponsiveContainer></div>
      <div className="legend-list">{data.map((item, index) => <div className="legend-row" key={item.name}>
        <span className="legend-dot" style={{ background: COLORS[index % COLORS.length] }} /><span>{item.name}</span><strong>{formatCurrency(item.value)}</strong>
      </div>)}</div>
    </div>}
  </article>
}
