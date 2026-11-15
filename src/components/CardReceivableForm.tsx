import { useState, type FormEvent } from 'react'
import { Check, X } from 'lucide-react'
import type { CardReceivableInput } from '../services/receivablesService'
import type { Transaction } from '../types/Transaction'
import { formatCurrency } from '../utils/currency'
import { parseMoneyInput, toMoneyInput } from '../utils/monthPlan'
import { validateCardReceivableAmount } from '../utils/receivables'

interface CardReceivableFormProps {
  transaction: Transaction
  onCancel: () => void
  onSave: (input: CardReceivableInput) => Promise<boolean>
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Formulário de cobrança de um lançamento do cartão.
 * A descrição é o snapshot do lançamento; a Transaction nunca é alterada.
 */
export function CardReceivableForm({ transaction, onCancel, onSave }: CardReceivableFormProps) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState(toMoneyInput(transaction.amount))
  const [dueDate, setDueDate] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const person = name.trim()
    if (person.length < 2 || person.length > 60) {
      setError('Informe a pessoa com 2 a 60 caracteres.')
      return
    }

    const value = parseMoneyInput(amount)
    const amountError = validateCardReceivableAmount(transaction.amount, value)
    if (amountError) {
      setError(amountError)
      return
    }

    const contactEmail = email.trim()
    if (contactEmail && !EMAIL_REGEX.test(contactEmail)) {
      setError('Informe um e-mail válido.')
      return
    }

    const contactPhone = phone.trim()
    const note = notes.trim()
    const due = dueDate.trim()

    setError('')
    setBusy(true)

    const ok = await onSave({
      contact: {
        name: person,
        ...(contactEmail ? { email: contactEmail } : {}),
        ...(contactPhone ? { phone: contactPhone } : {}),
      },
      amount: value,
      ...(due ? { dueDate: due } : {}),
      ...(note ? { notes: note } : {}),
    })

    setBusy(false)
    if (ok) onCancel()
  }

  return (
    <form className="receivable-form card-receivable-form" onSubmit={submit}>
      <div className="receivable-form-head">
        <div>
          <strong>A cobrar do cartão</strong>
          <small className="card-receivable-target">
            {transaction.title} · {formatCurrency(transaction.amount)}
          </small>
        </div>
        <button
          type="button"
          className="budget-icon-button"
          onClick={onCancel}
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
              value={name}
              autoFocus
              maxLength={60}
              placeholder="Ex.: Carlos"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
        </label>

        <label className="budget-field">
          <span>Valor a cobrar</span>
          <div>
            <small>R$</small>
            <input
              inputMode="decimal"
              value={amount}
              placeholder="0,00"
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
        </label>

        <label className="budget-field">
          <span>Vencimento</span>
          <div>
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </div>
        </label>

        <label className="budget-field">
          <span>E-mail</span>
          <div>
            <input
              type="email"
              value={email}
              placeholder="Opcional"
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        </label>

        <label className="budget-field">
          <span>Telefone</span>
          <div>
            <input
              type="tel"
              value={phone}
              placeholder="Opcional"
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
        </label>

        <label className="budget-field wide">
          <span>Observação</span>
          <div>
            <input
              value={notes}
              placeholder="Opcional"
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </label>
      </div>

      <small className="finance-hint">
        A cobrança não reduz a fatura: o cartão continua com{' '}
        {formatCurrency(transaction.amount)}. Recebimentos não viram receita.
      </small>
      {error && <div className="inline-error finance-error">{error}</div>}

      <div className="budget-actions">
        <button type="button" className="rules-reapply" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="button-primary" disabled={busy}>
          <Check size={14} /> {busy ? 'Salvando...' : 'Salvar cobrança'}
        </button>
      </div>
    </form>
  )
}
