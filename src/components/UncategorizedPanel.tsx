import { CheckCircle2, Tags } from 'lucide-react'
import type { Transaction, TransactionCategory } from '../types/Transaction'
import { TRANSACTION_CATEGORIES } from '../types/Transaction'
import { merchantKey } from '../services/categoryEngine'
import { formatCurrency } from '../utils/currency'

interface UncategorizedPanelProps {
  transactions: Transaction[]
  saving: boolean
  onAssign: (title: string, category: TransactionCategory) => void
}

interface MerchantGroup {
  key: string
  title: string
  originalTitle: string
  count: number
  total: number
}

const ASSIGNABLE_CATEGORIES = TRANSACTION_CATEGORIES.filter(
  (category) => category !== 'Não categorizado',
)

export function UncategorizedPanel({ transactions, saving, onAssign }: UncategorizedPanelProps) {
  const groups = new Map<string, MerchantGroup>()

  transactions
    .filter((item) => item.category === 'Não categorizado' && item.type !== 'payment')
    .forEach((item) => {
      const key = merchantKey(item.originalTitle)
      const current = groups.get(key)

      if (current) {
        current.count += 1
        current.total += item.amount
      } else {
        groups.set(key, {
          key,
          title: item.title,
          originalTitle: item.originalTitle,
          count: 1,
          total: item.amount,
        })
      }
    })

  const list = [...groups.values()].sort((a, b) => b.total - a.total)
  const totalAmount = list.reduce((sum, group) => sum + group.total, 0)
  const totalCount = list.reduce((sum, group) => sum + group.count, 0)

  if (!list.length) {
    return (
      <section className="panel uncat-panel uncat-done">
        <CheckCircle2 size={20} />
        <div>
          <strong>Tudo categorizado</strong>
          <span>Todos os lançamentos desta fatura possuem categoria.</span>
        </div>
      </section>
    )
  }

  return (
    <section className="panel uncat-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Classificação rápida</span>
          <h2>Não categorizados</h2>
          <p className="uncat-subtitle">
            Escolha uma categoria por estabelecimento. A regra é salva na sua conta e
            aplicada automaticamente nas próximas importações.
          </p>
        </div>
        <div className="uncat-total">
          <Tags size={18} />
          <div>
            <strong>{formatCurrency(totalAmount)}</strong>
            <span>{totalCount} lançamento(s)</span>
          </div>
        </div>
      </div>

      <div className="uncat-list">
        {list.map((group) => (
          <div className="uncat-row" key={group.key}>
            <div className="uncat-name">
              <strong>{group.title}</strong>
              <span>{group.count}x</span>
            </div>
            <span className="uncat-amount">{formatCurrency(group.total)}</span>
            <select
              className="category-select"
              value=""
              disabled={saving}
              onChange={(event) => {
                const value = event.target.value as TransactionCategory
                if (value) onAssign(group.originalTitle, value)
              }}
            >
              <option value="">Definir categoria...</option>
              {ASSIGNABLE_CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </section>
  )
}
