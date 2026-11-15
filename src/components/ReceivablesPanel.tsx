import { useEffect, useState, type FormEvent } from 'react'
import { Check, Coins, History, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import type {
  NewReceivable,
  NewReceivablePayment,
  Receivable,
  ReceivablePayment,
  ReceivableSource,
} from '../types/Receivable'
import { formatCurrency } from '../utils/currency'
import { formatAuthorLabel } from '../utils/authorship'
import { parseMoneyInput, toMoneyInput, todayIso } from '../utils/monthPlan'
import {
  RECEIVABLE_STATUS_LABELS,
  receivableBalance,
  receivablePaymentsFor,
  sortReceivables,
  totalReceivableBalance,
} from '../utils/receivables'
import { toCents } from '../utils/split'

interface ReceivablesPanelProps {
  receivables: Receivable[]
  payments: ReceivablePayment[]
  saving?: boolean
  canEdit?: boolean
  focusReceivableId?: string
  onSave: (receivable: NewReceivable) => Promise<boolean>
  onDelete: (receivable: Receivable) => Promise<boolean>
  onCreatePayment: (
    receivable: Receivable,
    payment: NewReceivablePayment,
  ) => Promise<boolean>
  onDeletePayment: (payment: ReceivablePayment) => Promise<boolean>
}

interface ReceivableForm {
  id?: string
  name: string
  description: string
  amount: string
  dueDate: string
  email: string
  phone: string
  notes: string
  source: ReceivableSource
}

const STATUS_LABELS = RECEIVABLE_STATUS_LABELS

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function formatDate(value?: string): string {
  if (!value) return ''
  const parts = value.split('-')
  if (parts.length !== 3) return value
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

export function ReceivablesPanel({
  receivables,
  payments,
  saving = false,
  canEdit = true,
  focusReceivableId,
  onSave,
  onDelete,
  onCreatePayment,
  onDeletePayment,
}: ReceivablesPanelProps) {
  const [form, setForm] = useState<ReceivableForm | null>(null)
  const [formError, setFormError] = useState('')
  const [paymentFor, setPaymentFor] = useState<string | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(todayIso())
  const [paymentNotes, setPaymentNotes] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const today = todayIso()
  const ordered = sortReceivables(receivables)
  const totals = totalReceivableBalance(receivables, payments, today)

  // "Ver cobrança" no cartão leva para o Meu mês e rola até o cartão correspondente.
  useEffect(() => {
    if (!focusReceivableId) return
    document
      .getElementById(`receivable-${focusReceivableId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusReceivableId])

  const openNew = () => {
    setFormError('')
    setForm({
      name: '',
      description: '',
      amount: '',
      dueDate: '',
      email: '',
      phone: '',
      notes: '',
      source: { type: 'manual' },
    })
  }

  const openEdit = (receivable: Receivable) => {
    setFormError('')
    setForm({
      id: receivable.id,
      name: receivable.contact.name,
      description: receivable.description,
      amount: toMoneyInput(receivable.amount),
      dueDate: receivable.dueDate ?? '',
      email: receivable.contact.email ?? '',
      phone: receivable.contact.phone ?? '',
      notes: receivable.notes ?? '',
      source: receivable.source,
    })
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form) return

    const name = form.name.trim()
    if (name.length < 2 || name.length > 60) {
      setFormError('Informe a pessoa com 2 a 60 caracteres.')
      return
    }

    const description = form.description.trim()
    if (description.length < 2 || description.length > 100) {
      setFormError('Informe a descrição com 2 a 100 caracteres.')
      return
    }

    const amount = parseMoneyInput(form.amount)
    if (!amount) {
      setFormError('Informe um valor maior que zero.')
      return
    }

    const email = form.email.trim()
    if (email && !EMAIL_REGEX.test(email)) {
      setFormError('Informe um e-mail válido.')
      return
    }

    const phone = form.phone.trim()
    const notes = form.notes.trim()
    const dueDate = form.dueDate.trim()

    setFormError('')
    setSavingKey(form.id ?? 'new')

    const payload: NewReceivable = {
      id: form.id,
      description,
      contact: {
        name,
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
      },
      amount,
      source: form.source,
      ...(dueDate ? { dueDate } : {}),
      ...(notes ? { notes } : {}),
    }

    const ok = await onSave(payload)
    setSavingKey(null)
    if (ok) setForm(null)
  }

  const openPayment = (receivable: Receivable, pending: number) => {
    setPaymentFor(receivable.id)
    setPaymentAmount(toMoneyInput(pending))
    setPaymentDate(todayIso())
    setPaymentNotes('')
    setPaymentError('')
  }

  const closePayment = () => {
    setPaymentFor(null)
    setPaymentAmount('')
    setPaymentNotes('')
    setPaymentError('')
  }

  const submitPayment = async (
    event: FormEvent<HTMLFormElement>,
    receivable: Receivable,
    pending: number,
  ) => {
    event.preventDefault()

    const parsed = parseMoneyInput(paymentAmount)
    if (parsed <= 0) {
      setPaymentError('Informe um valor maior que zero.')
      return
    }

    if (toCents(parsed) > toCents(pending)) {
      setPaymentError(`O valor não pode ultrapassar o pendente de ${formatCurrency(pending)}.`)
      return
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
      setPaymentError('Informe a data do recebimento.')
      return
    }

    setPaymentError('')
    setSavingKey(receivable.id)

    const notes = paymentNotes.trim()
    const ok = await onCreatePayment(receivable, {
      receivableId: receivable.id,
      amount: parsed,
      paymentDate,
      ...(notes ? { notes } : {}),
    })

    setSavingKey(null)
    if (ok) closePayment()
  }

  return (
    <section className="panel receivables-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Cobranças</span>
          <h2>A receber</h2>
          <span className="result-count">
            {ordered.length} cobrança(s) · não entra nas receitas do mês
          </span>
        </div>
        {canEdit && !form && (
          <button type="button" className="button-primary small" onClick={openNew}>
            <Plus size={16} /> Novo valor a receber
          </button>
        )}
      </div>

      <div className="receivables-summary">
        <div className="receivables-stat due">
          <span>Total devido</span>
          <strong>{formatCurrency(totals.due)}</strong>
        </div>
        <div className="receivables-stat received">
          <span>Total recebido</span>
          <strong>{formatCurrency(totals.received)}</strong>
        </div>
        <div className="receivables-stat pending">
          <span>Total pendente</span>
          <strong>{formatCurrency(totals.pending)}</strong>
        </div>
      </div>

      {canEdit && form && (
        <form className="receivable-form" onSubmit={submit}>
          <div className="receivable-form-head">
            <strong>{form.id ? 'Editar cobrança' : 'Novo valor a receber'}</strong>
            <button
              type="button"
              className="budget-icon-button"
              onClick={() => setForm(null)}
              aria-label="Cancelar"
            >
              <X size={16} />
            </button>
          </div>

          <div className="receivable-form-grid">
            <label className="budget-field">
              <span>Pessoa</span>
              <div>
                <input
                  value={form.name}
                  autoFocus
                  maxLength={60}
                  placeholder="Ex.: Carlos"
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </div>
            </label>

            <label className="budget-field wide">
              <span>Descrição</span>
              <div>
                <input
                  value={form.description}
                  maxLength={100}
                  placeholder="Ex.: Empréstimo, aluguel, venda"
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
              <span>Vencimento</span>
              <div>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
                />
              </div>
            </label>

            <label className="budget-field">
              <span>E-mail</span>
              <div>
                <input
                  type="email"
                  value={form.email}
                  placeholder="Opcional"
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </div>
            </label>

            <label className="budget-field">
              <span>Telefone</span>
              <div>
                <input
                  type="tel"
                  value={form.phone}
                  placeholder="Opcional"
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
              </div>
            </label>

            <label className="budget-field wide">
              <span>Observação</span>
              <div>
                <input
                  value={form.notes}
                  placeholder="Opcional"
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                />
              </div>
            </label>
          </div>

          <small className="finance-hint">
            Cobranças não são receitas: elas não entram no Meu mês, na previsão nem na sobra.
          </small>
          {formError && <div className="inline-error finance-error">{formError}</div>}

          <div className="budget-actions">
            <button type="button" className="rules-reapply" onClick={() => setForm(null)}>
              Cancelar
            </button>
            <button type="submit" className="button-primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar cobrança'}
            </button>
          </div>
        </form>
      )}

      <div className="receivables-list">
        {ordered.map((receivable) => {
          const balance = receivableBalance(receivable, payments, today)
          const history = receivablePaymentsFor(receivable.id, payments)
          const isPaymentOpen = paymentFor === receivable.id
          const hasDetails = Boolean(
            receivable.dueDate ||
              receivable.contact.email ||
              receivable.contact.phone ||
              receivable.notes,
          )

          return (
            <div
              className={`receivable-card${
                focusReceivableId === receivable.id ? ' receivable-focus' : ''
              }`}
              key={receivable.id}
              id={`receivable-${receivable.id}`}
            >
              <div className="receivable-header">
                <div className="receivable-person">
                  <strong>{receivable.contact.name}</strong>
                  <span>{receivable.description}</span>
                </div>
                <span className={`receivable-status-badge ${balance.status}`}>
                  {STATUS_LABELS[balance.status]}
                </span>
              </div>

              <div className="receivable-amounts">
                <div>
                  <span>Devido</span>
                  <strong>{formatCurrency(balance.due)}</strong>
                </div>
                <div>
                  <span>Recebido</span>
                  <strong className="positive">{formatCurrency(balance.received)}</strong>
                </div>
                <div>
                  <span>Pendente</span>
                  <strong className={balance.pending > 0 ? 'highlight' : ''}>
                    {formatCurrency(balance.pending)}
                  </strong>
                </div>
              </div>

              {hasDetails && (
                <div className="receivable-meta">
                  {receivable.dueDate && (
                    <span>Vencimento {formatDate(receivable.dueDate)}</span>
                  )}
                  {receivable.contact.email && <span>{receivable.contact.email}</span>}
                  {receivable.contact.phone && <span>{receivable.contact.phone}</span>}
                  {receivable.notes && (
                    <span className="receivable-notes">{receivable.notes}</span>
                  )}
                </div>
              )}

              {canEdit && (
                <div className="receivable-row-actions">
                  <button
                    type="button"
                    className="receivable-action-btn"
                    onClick={() => openEdit(receivable)}
                  >
                    <Pencil size={14} /> Editar
                  </button>
                  <button
                    type="button"
                    className="receivable-action-btn danger"
                    disabled={savingKey === receivable.id || saving}
                    onClick={() => void onDelete(receivable)}
                  >
                    <Trash2 size={14} /> Excluir
                  </button>
                </div>
              )}

              {history.length > 0 && (
                <div className="receivable-history">
                  <span className="receivable-history-title">
                    <History size={12} /> Recebimentos
                  </span>
                  <div className="receivable-history-list">
                    {history.map((payment) => {
                      const author = formatAuthorLabel(payment)

                      return (
                        <div className="receivable-history-item" key={payment.id}>
                          <span>
                            {formatCurrency(payment.amount)} em{' '}
                            {formatDate(payment.paymentDate)}
                            {author && ` · por ${author}`}
                            {payment.notes && ` · ${payment.notes}`}
                          </span>
                          {canEdit && (
                            <button
                              type="button"
                              className="receivable-undo-btn"
                              title="Desfazer este recebimento"
                              onClick={() => void onDeletePayment(payment)}
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

              {canEdit && balance.pending > 0 && !isPaymentOpen && (
                <div className="receivable-actions">
                  <button
                    type="button"
                    className="button-primary small"
                    onClick={() => openPayment(receivable, balance.pending)}
                  >
                    <Coins size={14} /> Registrar recebimento
                  </button>
                </div>
              )}

              {canEdit && balance.pending > 0 && isPaymentOpen && (
                <form
                  className="receivable-form payment"
                  onSubmit={(event) => void submitPayment(event, receivable, balance.pending)}
                >
                  <div className="receivable-form-head">
                    <strong>Registrar recebimento</strong>
                    <button
                      type="button"
                      className="budget-icon-button"
                      onClick={closePayment}
                      aria-label="Cancelar"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <div className="receivable-form-grid">
                    <label className="budget-field">
                      <span>Valor recebido (R$)</span>
                      <div>
                        <input
                          inputMode="decimal"
                          value={paymentAmount}
                          autoFocus
                          placeholder="0,00"
                          onChange={(event) => setPaymentAmount(event.target.value)}
                        />
                      </div>
                    </label>

                    <label className="budget-field">
                      <span>Data do recebimento</span>
                      <div>
                        <input
                          type="date"
                          value={paymentDate}
                          onChange={(event) => setPaymentDate(event.target.value)}
                        />
                      </div>
                    </label>

                    <label className="budget-field wide">
                      <span>Observação</span>
                      <div>
                        <input
                          value={paymentNotes}
                          placeholder="Opcional"
                          onChange={(event) => setPaymentNotes(event.target.value)}
                        />
                      </div>
                    </label>
                  </div>

                  {paymentError && (
                    <div className="inline-error finance-error">{paymentError}</div>
                  )}

                  <div className="budget-actions">
                    <button type="button" className="rules-reapply" onClick={closePayment}>
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="button-primary"
                      disabled={savingKey === receivable.id}
                    >
                      <Check size={14} /> Confirmar
                    </button>
                  </div>
                </form>
              )}
            </div>
          )
        })}

        {!ordered.length && !form && (
          <div className="empty-mini finance-empty receivables-empty">
            <Coins size={22} />
            <span>
              {canEdit
                ? 'Nenhuma cobrança registrada. Cadastre aqui o que alguém deve a você.'
                : 'Nenhuma cobrança registrada.'}
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
