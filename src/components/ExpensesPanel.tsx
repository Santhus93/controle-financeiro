import { useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2, Wallet, X } from 'lucide-react'
import { PAYMENT_METHODS, type Expense, type NewExpense, type PaymentMethod } from '../types/Finance'
import { TRANSACTION_CATEGORIES, type TransactionCategory } from '../types/Transaction'
import { formatCurrency } from '../utils/currency'
import { expensesForMonth, parseMoneyInput, toMoneyInput, todayIso } from '../utils/monthPlan'

interface ExpensesPanelProps {
  month: string
  expenses: Expense[]
  saving: boolean
  onSave: (expense: NewExpense) => Promise<boolean>
  onDelete: (expense: Expense) => void
}

interface ExpenseForm {
  id?: string
  description: string
  amount: string
  date: string
  category: TransactionCategory
  method: PaymentMethod
}

const CATEGORIES = TRANSACTION_CATEGORIES.filter((category) => category !== 'Não categorizado')

function formatShortDate(date: string): string {
  const [, month, day] = date.split('-')
  return `${day}/${month}`
}

export function ExpensesPanel({ month, expenses, saving, onSave, onDelete }: ExpensesPanelProps) {
  const [form, setForm] = useState<ExpenseForm | null>(null)
  const [formError, setFormError] = useState('')

  const monthExpenses = expensesForMonth(expenses, month)
  const total = monthExpenses.reduce((sum, item) => sum + item.amount, 0)

  const openNew = () => {
    const today = todayIso()
    setFormError('')
    setForm({
      description: '',
      amount: '',
      // Sugere hoje quando o mês exibido é o atual; senão, o primeiro dia do mês.
      date: today.startsWith(month) ? today : `${month}-01`,
      category: 'Alimentação',
      method: 'Pix',
    })
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form) return

    const amount = parseMoneyInput(form.amount)
    if (!form.description.trim()) return setFormError('Informe a descrição do gasto.')
    if (!amount) return setFormError('Informe o valor do gasto.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return setFormError('Informe a data do gasto.')

    setFormError('')
    const ok = await onSave({
      id: form.id,
      description: form.description,
      amount,
      date: form.date,
      category: form.category,
      method: form.method,
    })
    if (ok) setForm(null)
  }

  return (
    <section className="panel expenses-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Fora do cartão</span>
          <h2>Gastos avulsos</h2>
          <span className="result-count">
            {monthExpenses.length} gasto(s) · {formatCurrency(total)} no mês
          </span>
        </div>
        {!form && (
          <button type="button" className="button-primary small" onClick={openNew}>
            <Plus size={16} /> Novo gasto
          </button>
        )}
      </div>

      {form && (
        <form className="finance-form" onSubmit={submit}>
          <div className="finance-form-head">
            <strong>{form.id ? 'Editar gasto' : 'Novo gasto avulso'}</strong>
            <button type="button" className="budget-icon-button" onClick={() => setForm(null)} aria-label="Cancelar">
              <X size={16} />
            </button>
          </div>

          <div className="finance-grid">
            <label className="budget-field wide">
              <span>Descrição</span>
              <div>
                <input
                  value={form.description}
                  autoFocus
                  placeholder="Ex.: Feira, Pix para o Igor, Farmácia"
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </div>
            </label>

            <label className="budget-field">
              <span>Valor</span>
              <div>
                <small>R$</small>
                <input
                  inputMode="decimal"
                  value={form.amount}
                  placeholder="0,00"
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                />
              </div>
            </label>

            <label className="budget-field">
              <span>Data</span>
              <div>
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm({ ...form, date: event.target.value })}
                />
              </div>
            </label>

            <label className="budget-field">
              <span>Categoria</span>
              <div>
                <select
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value as TransactionCategory })}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </div>
            </label>

            <div className="budget-field">
              <span>Forma de pagamento</span>
              <div className="segmented">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    type="button"
                    key={method}
                    className={form.method === method ? 'active' : ''}
                    onClick={() => setForm({ ...form, method })}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <small className="finance-hint">
            Gastos no cartão de crédito não entram aqui: eles chegam pela fatura.
          </small>
          {formError && <div className="inline-error finance-error">{formError}</div>}

          <div className="budget-actions">
            <button type="button" className="rules-reapply" onClick={() => setForm(null)}>Cancelar</button>
            <button type="submit" className="button-primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar gasto'}
            </button>
          </div>
        </form>
      )}

      <div className="finance-list">
        {monthExpenses.map((expense) => (
          <div className="finance-row" key={expense.id}>
            <div className="finance-day expense">
              <small>{formatShortDate(expense.date).slice(3)}</small>
              <strong>{formatShortDate(expense.date).slice(0, 2)}</strong>
            </div>
            <div className="finance-info">
              <strong>{expense.description}</strong>
              <span>{expense.category} · {expense.method}</span>
            </div>
            <div className="finance-amount">{formatCurrency(expense.amount)}</div>
            <div className="finance-actions">
              <button
                type="button"
                aria-label="Editar"
                onClick={() => {
                  setFormError('')
                  setForm({
                    id: expense.id,
                    description: expense.description,
                    amount: toMoneyInput(expense.amount),
                    date: expense.date,
                    category: expense.category,
                    method: expense.method,
                  })
                }}
              >
                <Pencil size={15} />
              </button>
              <button type="button" className="danger" aria-label="Excluir" disabled={saving} onClick={() => onDelete(expense)}>
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {!monthExpenses.length && !form && (
          <div className="empty-mini finance-empty expenses-empty">
            <Wallet size={22} />
            <span>Nenhum gasto avulso neste mês. Registre aqui o que você paga no Pix, débito ou dinheiro.</span>
          </div>
        )}
      </div>
    </section>
  )
}
