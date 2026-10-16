import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Pencil, Target, X } from 'lucide-react'
import type { Transaction, TransactionCategory } from '../types/Transaction'
import { TRANSACTION_CATEGORIES } from '../types/Transaction'
import { hasBudget, type Budget } from '../services/budgetService'
import { formatCurrency } from '../utils/currency'

interface BudgetPanelProps {
  transactions: Transaction[]
  budget: Budget
  saving: boolean
  onSave: (budget: Budget) => void
}

const EXPENSE_TYPES = ['purchase', 'installment', 'pix_credit']

type Status = 'ok' | 'warning' | 'over'

function getStatus(spent: number, limit: number): Status {
  const ratio = spent / limit
  if (ratio > 1) return 'over'
  if (ratio >= 0.8) return 'warning'
  return 'ok'
}

/** Arredonda para cima em múltiplos de 50, para sugerir limites redondos. */
function roundUp(value: number): number {
  return Math.max(50, Math.ceil(value / 50) * 50)
}

function toInput(value: number | undefined): string {
  return value ? String(value).replace('.', ',') : ''
}

function fromInput(value: string): number {
  const parsed = Number(value.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function BudgetBar({ label, spent, limit }: { label: string; spent: number; limit: number }) {
  const status = getStatus(spent, limit)
  const percent = (spent / limit) * 100
  const remaining = limit - spent

  return (
    <div className={`budget-row ${status}`}>
      <div className="budget-row-head">
        <strong>{label}</strong>
        <span>
          {formatCurrency(spent)} <small>de {formatCurrency(limit)}</small>
        </span>
      </div>
      <div className="budget-bar">
        <span style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <div className="budget-row-foot">
        <span>{percent.toFixed(0)}% usado</span>
        <span>
          {remaining >= 0
            ? `Disponível ${formatCurrency(remaining)}`
            : `Excedeu ${formatCurrency(Math.abs(remaining))}`}
        </span>
      </div>
    </div>
  )
}

export function BudgetPanel({ transactions, budget, saving, onSave }: BudgetPanelProps) {
  const [editing, setEditing] = useState(false)
  const [monthlyInput, setMonthlyInput] = useState('')
  const [categoryInputs, setCategoryInputs] = useState<Record<string, string>>({})

  const expenses = transactions.filter((item) => EXPENSE_TYPES.includes(item.type) && item.amount > 0)
  const totalSpent = expenses.reduce((sum, item) => sum + item.amount, 0)

  const spentByCategory = new Map<TransactionCategory, number>()
  expenses.forEach((item) =>
    spentByCategory.set(item.category, (spentByCategory.get(item.category) ?? 0) + item.amount),
  )

  const configured = hasBudget(budget)

  const startEditing = () => {
    if (!configured) {
      // Sem orçamento: sugere valores com base nesta fatura, arredondados para cima.
      setMonthlyInput(toInput(roundUp(totalSpent)))
      const suggested: Record<string, string> = {}
      spentByCategory.forEach((value, category) => {
        if (category !== 'Não categorizado') suggested[category] = toInput(roundUp(value))
      })
      setCategoryInputs(suggested)
    } else {
      setMonthlyInput(toInput(budget.monthlyLimit))
      const current: Record<string, string> = {}
      Object.entries(budget.categories).forEach(([category, limit]) => {
        current[category] = toInput(limit)
      })
      setCategoryInputs(current)
    }
    setEditing(true)
  }

  const handleSave = () => {
    const categories: Budget['categories'] = {}
    Object.entries(categoryInputs).forEach(([category, value]) => {
      const limit = fromInput(value)
      if (limit > 0) categories[category as TransactionCategory] = limit
    })
    onSave({ monthlyLimit: fromInput(monthlyInput), categories })
    setEditing(false)
  }

  const categoryRows = (Object.entries(budget.categories) as Array<[TransactionCategory, number]>)
    .map(([category, limit]) => ({ category, limit, spent: spentByCategory.get(category) ?? 0 }))
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit)

  const alerts = categoryRows.filter((row) => getStatus(row.spent, row.limit) !== 'ok')
  const overCount = alerts.filter((row) => getStatus(row.spent, row.limit) === 'over').length
  const unbudgeted = [...spentByCategory.entries()]
    .filter(([category]) => !(category in budget.categories))
    .reduce((sum, [, value]) => sum + value, 0)

  if (editing) {
    return (
      <section className="panel budget-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Orçamento</span>
            <h2>Definir limites mensais</h2>
            <p className="uncat-subtitle">
              Deixe em branco as categorias sem limite. Os valores ficam salvos na sua conta e valem para todas as faturas.
              {!configured && ' Sugestão inicial calculada a partir desta fatura.'}
            </p>
          </div>
          <button type="button" className="budget-icon-button" onClick={() => setEditing(false)} aria-label="Cancelar">
            <X size={16} />
          </button>
        </div>

        <label className="budget-field budget-field-main">
          <span>Limite total da fatura</span>
          <div>
            <small>R$</small>
            <input
              inputMode="decimal"
              value={monthlyInput}
              onChange={(event) => setMonthlyInput(event.target.value)}
              placeholder="sem limite"
            />
          </div>
        </label>

        <div className="budget-form-grid">
          {TRANSACTION_CATEGORIES.filter((category) => category !== 'Não categorizado').map((category) => (
            <label className="budget-field" key={category}>
              <span>
                {category}
                {spentByCategory.get(category) ? (
                  <em> · nesta fatura {formatCurrency(spentByCategory.get(category) ?? 0)}</em>
                ) : null}
              </span>
              <div>
                <small>R$</small>
                <input
                  inputMode="decimal"
                  value={categoryInputs[category] ?? ''}
                  onChange={(event) =>
                    setCategoryInputs((current) => ({ ...current, [category]: event.target.value }))
                  }
                  placeholder="sem limite"
                />
              </div>
            </label>
          ))}
        </div>

        <div className="budget-actions">
          <button type="button" className="rules-reapply" onClick={() => setEditing(false)}>
            Cancelar
          </button>
          <button type="button" className="button-primary" disabled={saving} onClick={handleSave}>
            {saving ? 'Salvando...' : 'Salvar orçamento'}
          </button>
        </div>
      </section>
    )
  }

  if (!configured) {
    return (
      <section className="panel budget-panel budget-empty">
        <div className="budget-empty-icon"><Target size={22} /></div>
        <div>
          <strong>Defina um orçamento mensal</strong>
          <span>Estabeleça limites por categoria e acompanhe quanto já foi usado em cada fatura.</span>
        </div>
        <button type="button" className="button-primary" onClick={startEditing}>
          Definir orçamento
        </button>
      </section>
    )
  }

  return (
    <section className="panel budget-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Orçamento</span>
          <h2>Limites desta fatura</h2>
        </div>
        <button type="button" className="rules-reapply" onClick={startEditing}>
          <Pencil size={14} /> Editar
        </button>
      </div>

      <div className={`budget-alert ${alerts.length ? (overCount ? 'over' : 'warning') : 'ok'}`}>
        {alerts.length ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}
        <span>
          {!alerts.length
            ? 'Todas as categorias estão dentro do orçamento.'
            : `${overCount} categoria(s) acima do limite e ${alerts.length - overCount} perto do limite (80% ou mais).`}
        </span>
      </div>

      {budget.monthlyLimit > 0 && (
        <div className="budget-total">
          <BudgetBar label="Total da fatura" spent={totalSpent} limit={budget.monthlyLimit} />
        </div>
      )}

      <div className="budget-grid">
        {categoryRows.map((row) => (
          <BudgetBar key={row.category} label={row.category} spent={row.spent} limit={row.limit} />
        ))}
      </div>

      {unbudgeted > 0 && (
        <small className="budget-note">
          {formatCurrency(unbudgeted)} desta fatura estão em categorias sem limite definido.
        </small>
      )}
    </section>
  )
}
