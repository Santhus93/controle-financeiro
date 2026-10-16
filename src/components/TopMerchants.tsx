import { useState } from 'react'
import { Store, X } from 'lucide-react'
import type { Transaction } from '../types/Transaction'
import { merchantKey } from '../services/categoryEngine'
import { formatCurrency } from '../utils/currency'
import { formatDate } from '../utils/dates'

interface TopMerchantsProps {
  transactions: Transaction[]
}

interface MerchantGroup {
  key: string
  title: string
  category: string
  total: number
  items: Transaction[]
}

const EXPENSE_TYPES = ['purchase', 'installment', 'pix_credit']

export function TopMerchants({ transactions }: TopMerchantsProps) {
  const [selectedKey, setSelectedKey] = useState('')
  const groups = new Map<string, MerchantGroup>()

  transactions
    .filter((item) => EXPENSE_TYPES.includes(item.type) && item.amount > 0)
    .forEach((item) => {
      const key = merchantKey(item.originalTitle)
      const group = groups.get(key)
      if (group) {
        group.total += item.amount
        group.items.push(item)
      } else {
        groups.set(key, { key, title: item.title, category: item.category, total: item.amount, items: [item] })
      }
    })

  const ranking = [...groups.values()].sort((a, b) => b.total - a.total).slice(0, 10)
  const grandTotal = [...groups.values()].reduce((sum, group) => sum + group.total, 0)
  const max = ranking[0]?.total ?? 1
  const selected = ranking.find((group) => group.key === selectedKey)

  if (!ranking.length) return null

  return (
    <section className="panel merchants-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Ranking</span>
          <h2>Onde mais gastei</h2>
        </div>
        <span className="result-count">Top {ranking.length} estabelecimentos</span>
      </div>

      <div className="merchants-layout">
        <div className="merchant-list">
          {ranking.map((group, index) => (
            <button
              type="button"
              key={group.key}
              className={`merchant-row ${group.key === selectedKey ? 'active' : ''}`}
              onClick={() => setSelectedKey(group.key === selectedKey ? '' : group.key)}
            >
              <span className="merchant-rank">{String(index + 1).padStart(2, '0')}</span>
              <div className="merchant-info">
                <div className="merchant-line">
                  <strong>{group.title}</strong>
                  <span>{formatCurrency(group.total)}</span>
                </div>
                <div className="merchant-bar"><span style={{ width: `${(group.total / max) * 100}%` }} /></div>
                <small>
                  {group.category} · {group.items.length}x · {grandTotal ? ((group.total / grandTotal) * 100).toFixed(1) : '0'}% dos gastos
                </small>
              </div>
            </button>
          ))}
        </div>

        <div className="merchant-detail">
          {!selected ? (
            <div className="merchant-detail-empty">
              <Store size={26} />
              <span>Clique em um estabelecimento para ver os lançamentos.</span>
            </div>
          ) : (
            <>
              <div className="merchant-detail-head">
                <div>
                  <strong>{selected.title}</strong>
                  <span>
                    {selected.items.length} lançamento(s) · média {formatCurrency(selected.total / selected.items.length)}
                  </span>
                </div>
                <button type="button" onClick={() => setSelectedKey('')} aria-label="Fechar"><X size={16} /></button>
              </div>
              {[...selected.items]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((item) => (
                  <div className="merchant-detail-row" key={item.id}>
                    <span>{formatDate(item.date)}</span>
                    <strong>{formatCurrency(item.amount)}</strong>
                  </div>
                ))}
              <div className="merchant-detail-total">
                <span>Total</span>
                <strong>{formatCurrency(selected.total)}</strong>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
