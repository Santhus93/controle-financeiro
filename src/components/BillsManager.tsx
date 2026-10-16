import { useState, type FormEvent } from 'react'
import { Pencil, Plus, Receipt, Trash2, Wallet, X } from 'lucide-react'
import {
  BILL_CATEGORIES,
  type Bill,
  type BillCategory,
  type Income,
  type NewBill,
  type NewIncome,
} from '../types/Finance'
import { formatCurrency } from '../utils/currency'
import { formatMonthLabel } from '../utils/invoiceReference'
import { parseMoneyInput, toMoneyInput } from '../utils/monthPlan'

interface BillsManagerProps {
  month: string
  bills: Bill[]
  incomes: Income[]
  saving: boolean
  onSaveBill: (bill: NewBill) => Promise<boolean>
  onDeleteBill: (bill: Bill) => void
  onSaveIncome: (income: NewIncome) => Promise<boolean>
  onDeleteIncome: (income: Income) => void
}

interface BillForm {
  id?: string
  name: string
  category: BillCategory
  dueDay: string
  amount: string
  variable: boolean
  startMonth: string
}

interface IncomeForm {
  id?: string
  name: string
  amount: string
  recurring: boolean
  month: string
  day: string
}

export function BillsManager({
  month,
  bills,
  incomes,
  saving,
  onSaveBill,
  onDeleteBill,
  onSaveIncome,
  onDeleteIncome,
}: BillsManagerProps) {
  const emptyBill: BillForm = {
    name: '',
    category: 'Energia',
    dueDay: '10',
    amount: '',
    variable: false,
    startMonth: month,
  }
  const emptyIncome: IncomeForm = { name: '', amount: '', recurring: true, month, day: '5' }

  const [billForm, setBillForm] = useState<BillForm | null>(null)
  const [incomeForm, setIncomeForm] = useState<IncomeForm | null>(null)
  const [formError, setFormError] = useState('')

  const sortedBills = [...bills].sort((a, b) => a.dueDay - b.dueDay || a.name.localeCompare(b.name, 'pt-BR'))
  const sortedIncomes = [...incomes].sort((a, b) => Number(b.recurring) - Number(a.recurring) || a.day - b.day)
  const monthlyBills = bills.reduce((sum, bill) => sum + bill.amount, 0)
  const monthlyIncome = incomes.filter((income) => income.recurring).reduce((sum, income) => sum + income.amount, 0)

  const submitBill = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!billForm) return

    const amount = parseMoneyInput(billForm.amount)
    const dueDay = Number(billForm.dueDay)

    if (!billForm.name.trim()) return setFormError('Informe o nome da conta.')
    if (!amount) return setFormError(billForm.variable ? 'Informe um valor estimado.' : 'Informe o valor da conta.')
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) return setFormError('O dia de vencimento deve ser de 1 a 31.')

    setFormError('')
    const ok = await onSaveBill({
      id: billForm.id,
      name: billForm.name,
      category: billForm.category,
      dueDay,
      amount,
      variable: billForm.variable,
      startMonth: billForm.startMonth,
    })
    if (ok) setBillForm(null)
  }

  const submitIncome = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!incomeForm) return

    const amount = parseMoneyInput(incomeForm.amount)
    const day = Number(incomeForm.day)

    if (!incomeForm.name.trim()) return setFormError('Informe a descrição da receita.')
    if (!amount) return setFormError('Informe o valor da receita.')
    if (!Number.isInteger(day) || day < 1 || day > 31) return setFormError('O dia deve ser de 1 a 31.')

    setFormError('')
    const ok = await onSaveIncome({
      id: incomeForm.id,
      name: incomeForm.name,
      amount,
      recurring: incomeForm.recurring,
      month: incomeForm.month,
      day,
    })
    if (ok) setIncomeForm(null)
  }

  return (
    <div className="bills-view">
      <section className="panel bills-rule">
        <Receipt size={18} />
        <span>
          Cadastre aqui apenas o que <strong>não</strong> passa pelo cartão de crédito (boleto, débito
          automático, Pix). O que é pago no cartão já entra pela fatura.
        </span>
      </section>

      {/* ---------- Contas fixas ---------- */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Saídas recorrentes</span>
            <h2>Contas fixas</h2>
            <span className="result-count">{bills.length} conta(s) · {formatCurrency(monthlyBills)} por mês</span>
          </div>
          {!billForm && (
            <button
              type="button"
              className="button-primary small"
              onClick={() => {
                setIncomeForm(null)
                setFormError('')
                setBillForm(emptyBill)
              }}
            >
              <Plus size={16} /> Nova conta
            </button>
          )}
        </div>

        {billForm && (
          <form className="finance-form" onSubmit={submitBill}>
            <div className="finance-form-head">
              <strong>{billForm.id ? 'Editar conta' : 'Nova conta fixa'}</strong>
              <button type="button" className="budget-icon-button" onClick={() => setBillForm(null)} aria-label="Cancelar">
                <X size={16} />
              </button>
            </div>

            <div className="finance-grid">
              <label className="budget-field wide">
                <span>Nome</span>
                <div>
                  <input
                    value={billForm.name}
                    autoFocus
                    placeholder="Ex.: Luz (EDP), Aluguel, Internet"
                    onChange={(event) => setBillForm({ ...billForm, name: event.target.value })}
                  />
                </div>
              </label>

              <label className="budget-field">
                <span>Categoria</span>
                <div>
                  <select
                    value={billForm.category}
                    onChange={(event) => setBillForm({ ...billForm, category: event.target.value as BillCategory })}
                  >
                    {BILL_CATEGORIES.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="budget-field">
                <span>Dia do vencimento</span>
                <div>
                  <input
                    inputMode="numeric"
                    value={billForm.dueDay}
                    onChange={(event) => setBillForm({ ...billForm, dueDay: event.target.value.replace(/\D/g, '') })}
                  />
                </div>
              </label>

              <div className="budget-field">
                <span>Tipo de valor</span>
                <div className="segmented">
                  <button
                    type="button"
                    className={!billForm.variable ? 'active' : ''}
                    onClick={() => setBillForm({ ...billForm, variable: false })}
                  >
                    Fixo
                  </button>
                  <button
                    type="button"
                    className={billForm.variable ? 'active' : ''}
                    onClick={() => setBillForm({ ...billForm, variable: true })}
                  >
                    Variável
                  </button>
                </div>
              </div>

              <label className="budget-field">
                <span>{billForm.variable ? 'Valor estimado' : 'Valor'}</span>
                <div>
                  <small>R$</small>
                  <input
                    inputMode="decimal"
                    value={billForm.amount}
                    placeholder="0,00"
                    onChange={(event) => setBillForm({ ...billForm, amount: event.target.value })}
                  />
                </div>
              </label>

              <label className="budget-field">
                <span>A partir de</span>
                <div>
                  <input
                    type="month"
                    value={billForm.startMonth}
                    onChange={(event) => setBillForm({ ...billForm, startMonth: event.target.value || month })}
                  />
                </div>
              </label>
            </div>

            {billForm.variable && (
              <small className="finance-hint">
                Conta variável (água, luz, gás): o valor estimado é usado na previsão. Ao marcar como
                paga, você informa o valor real daquele mês.
              </small>
            )}
            {formError && <div className="inline-error finance-error">{formError}</div>}

            <div className="budget-actions">
              <button type="button" className="rules-reapply" onClick={() => setBillForm(null)}>Cancelar</button>
              <button type="submit" className="button-primary" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar conta'}
              </button>
            </div>
          </form>
        )}

        <div className="finance-list">
          {sortedBills.map((bill) => (
            <div className="finance-row" key={bill.id}>
              <div className="finance-day">
                <small>dia</small>
                <strong>{String(bill.dueDay).padStart(2, '0')}</strong>
              </div>
              <div className="finance-info">
                <strong>{bill.name}</strong>
                <span>
                  {bill.category} · {bill.variable ? 'variável' : 'fixo'} · desde {formatMonthLabel(bill.startMonth, 'short')}
                </span>
              </div>
              <div className="finance-amount">
                {formatCurrency(bill.amount)}
                {bill.variable && <small>estimado</small>}
              </div>
              <div className="finance-actions">
                <button
                  type="button"
                  aria-label="Editar"
                  onClick={() => {
                    setIncomeForm(null)
                    setFormError('')
                    setBillForm({
                      id: bill.id,
                      name: bill.name,
                      category: bill.category,
                      dueDay: String(bill.dueDay),
                      amount: toMoneyInput(bill.amount),
                      variable: bill.variable,
                      startMonth: bill.startMonth,
                    })
                  }}
                >
                  <Pencil size={15} />
                </button>
                <button type="button" className="danger" aria-label="Excluir" disabled={saving} onClick={() => onDeleteBill(bill)}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
          {!bills.length && !billForm && (
            <div className="empty-mini finance-empty">Nenhuma conta fixa cadastrada.</div>
          )}
        </div>
      </section>

      {/* ---------- Receitas ---------- */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Entradas</span>
            <h2>Receitas</h2>
            <span className="result-count">{formatCurrency(monthlyIncome)} recorrente por mês</span>
          </div>
          {!incomeForm && (
            <button
              type="button"
              className="button-primary small"
              onClick={() => {
                setBillForm(null)
                setFormError('')
                setIncomeForm(emptyIncome)
              }}
            >
              <Plus size={16} /> Nova receita
            </button>
          )}
        </div>

        {incomeForm && (
          <form className="finance-form" onSubmit={submitIncome}>
            <div className="finance-form-head">
              <strong>{incomeForm.id ? 'Editar receita' : 'Nova receita'}</strong>
              <button type="button" className="budget-icon-button" onClick={() => setIncomeForm(null)} aria-label="Cancelar">
                <X size={16} />
              </button>
            </div>

            <div className="finance-grid">
              <label className="budget-field wide">
                <span>Descrição</span>
                <div>
                  <input
                    value={incomeForm.name}
                    autoFocus
                    placeholder="Ex.: Salário, Freela, Aluguel recebido"
                    onChange={(event) => setIncomeForm({ ...incomeForm, name: event.target.value })}
                  />
                </div>
              </label>

              <label className="budget-field">
                <span>Valor</span>
                <div>
                  <small>R$</small>
                  <input
                    inputMode="decimal"
                    value={incomeForm.amount}
                    placeholder="0,00"
                    onChange={(event) => setIncomeForm({ ...incomeForm, amount: event.target.value })}
                  />
                </div>
              </label>

              <label className="budget-field">
                <span>Dia em que entra</span>
                <div>
                  <input
                    inputMode="numeric"
                    value={incomeForm.day}
                    onChange={(event) => setIncomeForm({ ...incomeForm, day: event.target.value.replace(/\D/g, '') })}
                  />
                </div>
              </label>

              <div className="budget-field">
                <span>Frequência</span>
                <div className="segmented">
                  <button
                    type="button"
                    className={incomeForm.recurring ? 'active' : ''}
                    onClick={() => setIncomeForm({ ...incomeForm, recurring: true })}
                  >
                    Todo mês
                  </button>
                  <button
                    type="button"
                    className={!incomeForm.recurring ? 'active' : ''}
                    onClick={() => setIncomeForm({ ...incomeForm, recurring: false })}
                  >
                    Só uma vez
                  </button>
                </div>
              </div>

              <label className="budget-field">
                <span>{incomeForm.recurring ? 'A partir de' : 'Mês'}</span>
                <div>
                  <input
                    type="month"
                    value={incomeForm.month}
                    onChange={(event) => setIncomeForm({ ...incomeForm, month: event.target.value || month })}
                  />
                </div>
              </label>
            </div>

            {formError && <div className="inline-error finance-error">{formError}</div>}

            <div className="budget-actions">
              <button type="button" className="rules-reapply" onClick={() => setIncomeForm(null)}>Cancelar</button>
              <button type="submit" className="button-primary" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar receita'}
              </button>
            </div>
          </form>
        )}

        <div className="finance-list">
          {sortedIncomes.map((income) => (
            <div className="finance-row" key={income.id}>
              <div className="finance-day income">
                <Wallet size={16} />
              </div>
              <div className="finance-info">
                <strong>{income.name}</strong>
                <span>
                  Dia {income.day} ·{' '}
                  {income.recurring
                    ? `todo mês desde ${formatMonthLabel(income.month, 'short')}`
                    : `só em ${formatMonthLabel(income.month)}`}
                </span>
              </div>
              <div className="finance-amount positive">{formatCurrency(income.amount)}</div>
              <div className="finance-actions">
                <button
                  type="button"
                  aria-label="Editar"
                  onClick={() => {
                    setBillForm(null)
                    setFormError('')
                    setIncomeForm({
                      id: income.id,
                      name: income.name,
                      amount: toMoneyInput(income.amount),
                      recurring: income.recurring,
                      month: income.month,
                      day: String(income.day),
                    })
                  }}
                >
                  <Pencil size={15} />
                </button>
                <button type="button" className="danger" aria-label="Excluir" disabled={saving} onClick={() => onDeleteIncome(income)}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
          {!incomes.length && !incomeForm && (
            <div className="empty-mini finance-empty">Nenhuma receita cadastrada.</div>
          )}
        </div>
      </section>
    </div>
  )
}
