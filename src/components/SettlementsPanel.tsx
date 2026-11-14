import { useState, type FormEvent } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Coins,
  History,
  RotateCcw,
  X,
} from 'lucide-react'
import type { Expense } from '../types/Finance'
import type { SpaceMember } from '../types/Space'
import type { NewSettlement, Settlement } from '../types/Settlement'
import { formatCurrency } from '../utils/currency'
import { formatAuthorLabel } from '../utils/authorship'
import { parseMoneyInput, toMoneyInput } from '../utils/monthPlan'
import {
  fromCents,
  payablesFor,
  receivablesFor,
  toCents,
  type SettlementLine,
} from '../utils/split'

interface SettlementsPanelProps {
  currentUid: string
  expenses: Expense[]
  settlements: Settlement[]
  members: SpaceMember[]
  canEdit?: boolean
  isShared?: boolean
  onCreateSettlement: (expense: Expense, settlement: NewSettlement) => Promise<boolean>
  onDeleteSettlement: (settlement: Settlement) => Promise<boolean>
}

function counterpartDisplay(line: SettlementLine, members: SpaceMember[]): string {
  if (line.counterpartName?.trim()) return line.counterpartName.trim()
  if (line.counterpartEmail?.trim()) return line.counterpartEmail.trim()

  const found = members.find((m) => m.uid === line.counterpartUid)
  if (found?.name?.trim()) return found.name.trim()
  if (found?.email?.trim()) return found.email.trim()

  return 'Membro'
}

function formatDate(dateStr: string): string {
  const parts = dateStr.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`
  return dateStr
}

function formatSettlementDate(date?: Date): string {
  if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}`
}

export function SettlementsPanel({
  currentUid,
  expenses,
  settlements,
  members,
  canEdit = true,
  isShared = false,
  onCreateSettlement,
  onDeleteSettlement,
}: SettlementsPanelProps) {
  const [activeFormKey, setActiveFormKey] = useState<string | null>(null)
  const [formAmount, setFormAmount] = useState('')
  const [formError, setFormError] = useState('')
  const [savingKey, setSavingKey] = useState<string | null>(null)

  if (!isShared) return null

  const hasDividedExpenses = expenses.some((e) => Boolean(e.split))

  const receivables = receivablesFor(currentUid, expenses, settlements)
  const payables = payablesFor(currentUid, expenses, settlements)

  const totalReceivable = receivables.reduce((sum, item) => sum + toCents(item.pending), 0)
  const totalPayable = payables.reduce((sum, item) => sum + toCents(item.pending), 0)

  const allClear =
    hasDividedExpenses &&
    totalReceivable === 0 &&
    totalPayable === 0 &&
    (receivables.length > 0 || payables.length > 0)

  const openForm = (key: string, defaultAmount: number) => {
    setActiveFormKey(key)
    setFormAmount(toMoneyInput(defaultAmount))
    setFormError('')
  }

  const closeForm = () => {
    setActiveFormKey(null)
    setFormAmount('')
    setFormError('')
  }

  const handleSubmitSettlement = async (
    event: FormEvent,
    line: SettlementLine,
    isReceivable: boolean,
  ) => {
    event.preventDefault()
    const key = `${line.expenseId}:${line.counterpartUid}`
    const parsed = parseMoneyInput(formAmount)

    if (parsed <= 0) {
      setFormError('Informe um valor maior que zero.')
      return
    }

    if (toCents(parsed) > toCents(line.pending)) {
      setFormError(
        `O valor não pode ultrapassar o pendente de ${formatCurrency(line.pending)}.`,
      )
      return
    }

    const expense = expenses.find((e) => e.id === line.expenseId)
    if (!expense) {
      setFormError('Gasto não encontrado.')
      return
    }

    setSavingKey(key)
    setFormError('')

    const fromUid = isReceivable ? line.counterpartUid : currentUid
    const toUid = isReceivable ? currentUid : line.counterpartUid

    const ok = await onCreateSettlement(expense, {
      expenseId: line.expenseId,
      fromUid,
      toUid,
      amount: parsed,
    })

    setSavingKey(null)
    if (ok) closeForm()
  }

  return (
    <section className="panel settlements-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Divisão de despesas</span>
          <h2>Acertos do espaço</h2>
        </div>
      </div>

      <div className="settlements-summary">
        <div className="settlements-stat receivable">
          <div className="settlements-stat-icon">
            <ArrowDownLeft size={18} />
          </div>
          <div>
            <span>A receber</span>
            <strong>{formatCurrency(fromCents(totalReceivable))}</strong>
          </div>
        </div>

        <div className="settlements-stat payable">
          <div className="settlements-stat-icon">
            <ArrowUpRight size={18} />
          </div>
          <div>
            <span>A pagar</span>
            <strong>{formatCurrency(fromCents(totalPayable))}</strong>
          </div>
        </div>
      </div>

      {!hasDividedExpenses && (
        <div className="empty-mini finance-empty settlements-empty">
          <Coins size={22} />
          <span>Nenhum gasto dividido neste espaço.</span>
        </div>
      )}

      {allClear && (
        <div className="settlements-all-clear">
          <CheckCircle2 size={18} />
          <span>Todos os acertos estão em dia.</span>
        </div>
      )}

      {receivables.length > 0 && (
        <div className="settlements-section">
          <h3 className="settlements-section-title">
            <ArrowDownLeft size={16} /> A receber
          </h3>
          <div className="settlements-list">
            {receivables.map((line) => {
              const key = `${line.expenseId}:${line.counterpartUid}`
              const isFormOpen = activeFormKey === key
              const counterpart = counterpartDisplay(line, members)
              const lineSettlements = settlements.filter(
                (s) => s.expenseId === line.expenseId && s.fromUid === line.counterpartUid,
              )

              return (
                <div className="settlement-card" key={key}>
                  <div className="settlement-header">
                    <div className="settlement-person">
                      <strong>{counterpart}</strong>
                      <span>
                        {line.description} · {formatDate(line.date)}
                      </span>
                    </div>
                    <span className={`settlement-status-badge ${line.status}`}>
                      {line.status === 'paid' && 'Pago'}
                      {line.status === 'partial' && 'Parcial'}
                      {line.status === 'pending' && 'Pendente'}
                    </span>
                  </div>

                  <div className="settlement-amounts">
                    <div>
                      <span>Devido</span>
                      <strong>{formatCurrency(line.due)}</strong>
                    </div>
                    <div>
                      <span>Recebido</span>
                      <strong className="positive">{formatCurrency(line.received)}</strong>
                    </div>
                    <div>
                      <span>Pendente</span>
                      <strong className={line.pending > 0 ? 'highlight' : ''}>
                        {formatCurrency(line.pending)}
                      </strong>
                    </div>
                  </div>

                  {lineSettlements.length > 0 && (
                    <div className="settlement-history">
                      <span className="settlement-history-title">
                        <History size={12} /> Histórico de acertos
                      </span>
                      <div className="settlement-history-list">
                        {lineSettlements.map((s) => {
                          const author = formatAuthorLabel(s)
                          const date = formatSettlementDate(s.createdAt)
                          return (
                            <div className="settlement-history-item" key={s.id}>
                              <span>
                                {formatCurrency(s.amount)}
                                {date && ` em ${date}`}
                                {author && ` · por ${author}`}
                              </span>
                              {canEdit && (
                                <button
                                  type="button"
                                  className="settlement-undo-btn"
                                  title="Desfazer este acerto"
                                  onClick={() => void onDeleteSettlement(s)}
                                >
                                  <RotateCcw size={13} /> Desfazer
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {canEdit && line.pending > 0 && !isFormOpen && (
                    <div className="settlement-actions">
                      <button
                        type="button"
                        className="button-primary small"
                        onClick={() => openForm(key, line.pending)}
                      >
                        Registrar recebimento
                      </button>
                    </div>
                  )}

                  {canEdit && isFormOpen && (
                    <form
                      className="settlement-form"
                      onSubmit={(e) => void handleSubmitSettlement(e, line, true)}
                    >
                      <div className="settlement-form-row">
                        <label className="budget-field">
                          <span>Valor recebido (R$)</span>
                          <div>
                            <input
                              inputMode="decimal"
                              value={formAmount}
                              autoFocus
                              placeholder="0,00"
                              onChange={(e) => setFormAmount(e.target.value)}
                            />
                          </div>
                        </label>
                        <div className="settlement-form-buttons">
                          <button
                            type="submit"
                            className="button-primary small"
                            disabled={savingKey === key}
                          >
                            <Check size={14} /> Confirmar
                          </button>
                          <button
                            type="button"
                            className="budget-icon-button"
                            onClick={closeForm}
                            aria-label="Cancelar"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </div>
                      {formError && <span className="inline-error">{formError}</span>}
                    </form>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {payables.length > 0 && (
        <div className="settlements-section">
          <h3 className="settlements-section-title">
            <ArrowUpRight size={16} /> A pagar
          </h3>
          <div className="settlements-list">
            {payables.map((line) => {
              const key = `${line.expenseId}:${line.counterpartUid}`
              const isFormOpen = activeFormKey === key
              const counterpart = counterpartDisplay(line, members)
              const lineSettlements = settlements.filter(
                (s) => s.expenseId === line.expenseId && s.fromUid === currentUid,
              )

              return (
                <div className="settlement-card" key={key}>
                  <div className="settlement-header">
                    <div className="settlement-person">
                      <strong>Para {counterpart}</strong>
                      <span>
                        {line.description} · {formatDate(line.date)}
                      </span>
                    </div>
                    <span className={`settlement-status-badge ${line.status}`}>
                      {line.status === 'paid' && 'Pago'}
                      {line.status === 'partial' && 'Parcial'}
                      {line.status === 'pending' && 'Pendente'}
                    </span>
                  </div>

                  <div className="settlement-amounts">
                    <div>
                      <span>Devido</span>
                      <strong>{formatCurrency(line.due)}</strong>
                    </div>
                    <div>
                      <span>Pago</span>
                      <strong className="positive">{formatCurrency(line.received)}</strong>
                    </div>
                    <div>
                      <span>Pendente</span>
                      <strong className={line.pending > 0 ? 'highlight' : ''}>
                        {formatCurrency(line.pending)}
                      </strong>
                    </div>
                  </div>

                  {lineSettlements.length > 0 && (
                    <div className="settlement-history">
                      <span className="settlement-history-title">
                        <History size={12} /> Histórico de acertos
                      </span>
                      <div className="settlement-history-list">
                        {lineSettlements.map((s) => {
                          const author = formatAuthorLabel(s)
                          const date = formatSettlementDate(s.createdAt)
                          return (
                            <div className="settlement-history-item" key={s.id}>
                              <span>
                                {formatCurrency(s.amount)}
                                {date && ` em ${date}`}
                                {author && ` · por ${author}`}
                              </span>
                              {canEdit && (
                                <button
                                  type="button"
                                  className="settlement-undo-btn"
                                  title="Desfazer este acerto"
                                  onClick={() => void onDeleteSettlement(s)}
                                >
                                  <RotateCcw size={13} /> Desfazer
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {canEdit && line.pending > 0 && !isFormOpen && (
                    <div className="settlement-actions">
                      <button
                        type="button"
                        className="button-primary small"
                        onClick={() => openForm(key, line.pending)}
                      >
                        Registrar pagamento
                      </button>
                    </div>
                  )}

                  {canEdit && isFormOpen && (
                    <form
                      className="settlement-form"
                      onSubmit={(e) => void handleSubmitSettlement(e, line, false)}
                    >
                      <div className="settlement-form-row">
                        <label className="budget-field">
                          <span>Valor pago (R$)</span>
                          <div>
                            <input
                              inputMode="decimal"
                              value={formAmount}
                              autoFocus
                              placeholder="0,00"
                              onChange={(e) => setFormAmount(e.target.value)}
                            />
                          </div>
                        </label>
                        <div className="settlement-form-buttons">
                          <button
                            type="submit"
                            className="button-primary small"
                            disabled={savingKey === key}
                          >
                            <Check size={14} /> Confirmar
                          </button>
                          <button
                            type="button"
                            className="budget-icon-button"
                            onClick={closeForm}
                            aria-label="Cancelar"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </div>
                      {formError && <span className="inline-error">{formError}</span>}
                    </form>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
