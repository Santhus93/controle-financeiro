import { useState } from 'react'
import { ChevronDown, ChevronUp, RefreshCw, Trash2 } from 'lucide-react'
import type { Transaction, TransactionCategory } from '../types/Transaction'
import { TRANSACTION_CATEGORIES } from '../types/Transaction'
import { merchantKey } from '../services/categoryEngine'
import type { CategoryRule } from '../services/categoryRulesService'

interface CategoryRulesProps {
  rules: CategoryRule[]
  transactions: Transaction[]
  saving: boolean
  onChange: (rule: CategoryRule, category: TransactionCategory) => void
  onDelete: (rule: CategoryRule) => void
  onReapply: () => void
}

export function CategoryRules({
  rules,
  transactions,
  saving,
  onChange,
  onDelete,
  onReapply,
}: CategoryRulesProps) {
  const [open, setOpen] = useState(false)

  const countInInvoice = (rule: CategoryRule) =>
    transactions.filter((item) => merchantKey(item.originalTitle) === rule.pattern).length

  return (
    <section className="panel rules-panel">
      <div className="panel-heading rules-heading">
        <button type="button" className="rules-toggle" onClick={() => setOpen((current) => !current)}>
          <div>
            <span className="eyebrow">De-Para</span>
            <h2>Regras de categoria ({rules.length})</h2>
          </div>
          {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>

        <button
          type="button"
          className="rules-reapply"
          disabled={saving || !rules.length || !transactions.length}
          onClick={onReapply}
        >
          <RefreshCw size={15} /> Reaplicar nesta fatura
        </button>
      </div>

      {open && (
        <div className="table-scroll">
          {!rules.length ? (
            <div className="empty-mini rules-empty">
              Nenhuma regra criada. Classifique um lançamento para criar a primeira.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Estabelecimento</th>
                  <th>Chave da regra</th>
                  <th>Nesta fatura</th>
                  <th>Categoria</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td><strong className="merchant">{rule.sampleTitle}</strong></td>
                    <td><code>{rule.pattern}</code></td>
                    <td>{countInInvoice(rule)}</td>
                    <td>
                      <select
                        className="category-select"
                        value={rule.category}
                        disabled={saving}
                        onChange={(event) => onChange(rule, event.target.value as TransactionCategory)}
                      >
                        {TRANSACTION_CATEGORIES.map((category) => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </td>
                    <td className="money">
                      <button
                        type="button"
                        className="rule-delete"
                        disabled={saving}
                        onClick={() => onDelete(rule)}
                        aria-label="Excluir regra"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  )
}
