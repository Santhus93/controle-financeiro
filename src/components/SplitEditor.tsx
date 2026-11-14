import { useState, type ChangeEvent } from 'react'
import type { ExpenseShare, ExpenseSplit } from '../types/Finance'
import type { SpaceMember } from '../types/Space'
import { formatCurrency } from '../utils/currency'
import { parseMoneyInput, toMoneyInput } from '../utils/monthPlan'
import { fromCents, splitEvenly, splitMemberLabel, toCents, validateExpenseSplit } from '../utils/split'

interface SplitEditorProps {
  total: number
  members: SpaceMember[]
  value?: ExpenseSplit
  currentUid: string
  disabled?: boolean
  onChange: (split: ExpenseSplit | undefined) => void
}

function memberLabel(member: SpaceMember): string {
  const name = member.name?.trim()
  if (name) return name

  const email = member.email?.trim()
  if (email) return email

  return 'Membro'
}

/**
 * Bloco de divisão exibido dentro do formulário de gasto avulso.
 * Não salva sozinho: devolve a divisão para o formulário e valida a soma.
 */
export function SplitEditor({
  total,
  members,
  value,
  currentUid,
  disabled = false,
  onChange,
}: SplitEditorProps) {
  // Valores monetários são não controlados para não atrapalhar a digitação.
  // A revisão força a remontagem quando a divisão é recalculada automaticamente.
  const [revision, setRevision] = useState(0)

  const recalculate = (uids: string[], paidByUid: string) => {
    const amounts = splitEvenly(total, uids)
    const shares: ExpenseShare[] = uids.map((uid) => {
      const member = members.find((item) => item.uid === uid)
      const name = member?.name?.trim() ?? ''
      const email = member?.email?.trim() ?? ''

      return {
        uid,
        ...(name ? { name } : {}),
        ...(email ? { email } : {}),
        amount: amounts[uid] ?? 0,
      }
    })

    setRevision((current) => current + 1)
    onChange({ paidByUid, shares })
  }

  const handleToggle = (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.checked) {
      onChange(undefined)
      return
    }

    const uids = members.map((member) => member.uid)
    const paidByUid = uids.includes(currentUid) ? currentUid : uids[0]

    if (!paidByUid) return
    recalculate(uids, paidByUid)
  }

  const toggleParticipant = (uid: string) => {
    if (!value || disabled) return

    const selected = value.shares.map((share) => share.uid)
    const isSelected = selected.includes(uid)

    // Quem pagou precisa continuar participando.
    if (isSelected && uid === value.paidByUid) return

    const nextSelected = members
      .map((member) => member.uid)
      .filter((memberUid) => (memberUid === uid ? !isSelected : selected.includes(memberUid)))

    if (nextSelected.length < 2) return
    recalculate(nextSelected, value.paidByUid)
  }

  const changeAmount = (uid: string, text: string) => {
    if (!value) return

    const amount = parseMoneyInput(text)
    onChange({
      paidByUid: value.paidByUid,
      shares: value.shares.map((share) =>
        share.uid === uid ? { ...share, amount } : share,
      ),
    })
  }

  const sumCents = value
    ? value.shares.reduce((sum, share) => sum + toCents(share.amount), 0)
    : 0
  const validation = value
    ? validateExpenseSplit(total, value, members.map((member) => member.uid))
    : null

  return (
    <div className="split-editor">
      <label className="split-toggle">
        <input type="checkbox" checked={Boolean(value)} disabled={disabled} onChange={handleToggle} />
        <span>Dividir entre membros</span>
      </label>

      {value && (
        <div className="split-body">
          <label className="split-payer">
            <span>Quem pagou?</span>
            <select
              value={value.paidByUid}
              disabled={disabled}
              onChange={(event) => onChange({ ...value, paidByUid: event.target.value })}
            >
              {value.shares.map((share) => (
                <option key={share.uid} value={share.uid}>
                  {splitMemberLabel(share)}
                </option>
              ))}
            </select>
          </label>

          <div className="split-members">
            <span className="split-members-title">Participantes</span>
            {members.map((member) => {
              const share = value.shares.find((item) => item.uid === member.uid)
              const isPayer = member.uid === value.paidByUid

              return (
                <div className={`split-member${share ? ' selected' : ''}`} key={member.uid}>
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(share)}
                      disabled={disabled || (Boolean(share) && isPayer)}
                      title={
                        share && isPayer ? 'Quem pagou precisa continuar na divisão.' : undefined
                      }
                      onChange={() => toggleParticipant(member.uid)}
                    />
                    <span>{memberLabel(member)}</span>
                  </label>

                  {share && (
                    <label className="split-amount">
                      <small>R$</small>
                      <input
                        key={`${member.uid}-${revision}`}
                        inputMode="decimal"
                        defaultValue={toMoneyInput(share.amount)}
                        disabled={disabled}
                        aria-label={`Valor de ${memberLabel(member)}`}
                        onChange={(event) => changeAmount(member.uid, event.target.value)}
                      />
                    </label>
                  )}
                </div>
              )
            })}
          </div>

          <div className={`split-total ${validation?.valid ? 'valid' : 'invalid'}`}>
            Total dividido {formatCurrency(fromCents(sumCents))} / {formatCurrency(total)}
            {validation?.valid ? ' ✓' : ''}
          </div>

          {validation && !validation.valid && (
            <small className="split-message">{validation.message}</small>
          )}
        </div>
      )}
    </div>
  )
}
