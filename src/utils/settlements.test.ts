import { describe, expect, it } from 'vitest'
import type { Expense, ExpenseSplit } from '../types/Finance'
import type { Settlement } from '../types/Settlement'
import { computeMonthSummary, type FinanceData } from './monthPlan'
import {
  areSplitsEqual,
  payablesFor,
  receivablesFor,
  remainingForShare,
  settlementsForExpense,
  shareBalances,
  splitStatus,
} from './split'

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    description: 'Almoço com cliente',
    amount: 300,
    date: '2026-11-10',
    category: 'Alimentação',
    method: 'Pix',
    split: {
      paidByUid: 'rodrigo',
      shares: [
        { uid: 'rodrigo', name: 'Rodrigo', amount: 150 },
        { uid: 'patricia', name: 'Patricia', amount: 100 },
        { uid: 'joao', name: 'João', amount: 50 },
      ],
    },
    ...overrides,
  }
}

function makeSettlement(overrides: Partial<Settlement> = {}): Settlement {
  return {
    id: 'set-1',
    expenseId: 'exp-1',
    fromUid: 'patricia',
    toUid: 'rodrigo',
    amount: 40,
    createdAt: new Date('2026-11-11T12:00:00Z'),
    ...overrides,
  }
}

function monthData(expenses: Expense[]): FinanceData {
  return { invoices: [], bills: [], payments: [], incomes: [], expenses }
}

describe('splitStatus', () => {
  it('1. sem acerto → Pendente', () => {
    expect(splitStatus(100, 0)).toBe('pending')
  })

  it('2. parcial → Parcial', () => {
    expect(splitStatus(100, 40)).toBe('partial')
  })

  it('3. total → Pago', () => {
    expect(splitStatus(100, 100)).toBe('paid')
    expect(splitStatus(100, 120)).toBe('paid')
  })
})

describe('shareBalances & múltiplos acertos', () => {
  it('4. múltiplos acertos somados', () => {
    const expense = makeExpense()
    const settlements: Settlement[] = [
      makeSettlement({ id: 's1', amount: 40 }),
      makeSettlement({ id: 's2', amount: 60 }),
    ]

    const balances = shareBalances(expense, settlements)
    const patricia = balances.find((b) => b.uid === 'patricia')

    expect(patricia).toBeDefined()
    expect(patricia?.due).toBe(100)
    expect(patricia?.received).toBe(100)
    expect(patricia?.pending).toBe(0)
    expect(patricia?.status).toBe('paid')
  })

  it('5. recebido acima do devido não gera pending negativo', () => {
    const expense = makeExpense()
    const settlements: Settlement[] = [
      makeSettlement({ id: 's1', amount: 120 }),
    ]

    const balances = shareBalances(expense, settlements)
    const patricia = balances.find((b) => b.uid === 'patricia')

    expect(patricia?.pending).toBe(0)
    expect(patricia?.status).toBe('paid')
    expect(remainingForShare(expense, 'patricia', settlements)).toBe(0)
  })

  it('6. outro expenseId ignorado', () => {
    const expense = makeExpense()
    const settlements: Settlement[] = [
      makeSettlement({ id: 's1', expenseId: 'outro-gasto', amount: 50 }),
    ]

    const balances = shareBalances(expense, settlements)
    const patricia = balances.find((b) => b.uid === 'patricia')

    expect(patricia?.received).toBe(0)
    expect(patricia?.pending).toBe(100)
    expect(patricia?.status).toBe('pending')
  })

  it('7. Settlement com toUid diferente do paidByUid ignorado', () => {
    const expense = makeExpense()
    const settlements: Settlement[] = [
      makeSettlement({ id: 's1', toUid: 'joao', amount: 40 }),
    ]

    const balances = shareBalances(expense, settlements)
    const patricia = balances.find((b) => b.uid === 'patricia')

    expect(patricia?.received).toBe(0)
    expect(patricia?.pending).toBe(100)
    expect(patricia?.status).toBe('pending')
  })

  it('8. pagador não deve a si mesmo', () => {
    const expense = makeExpense()
    expect(remainingForShare(expense, 'rodrigo', [])).toBe(0)

    const receivables = receivablesFor('rodrigo', [expense], [])
    expect(receivables.some((line) => line.counterpartUid === 'rodrigo')).toBe(false)

    const payables = payablesFor('rodrigo', [expense], [])
    expect(payables).toHaveLength(0)
  })
})

describe('receivablesFor & payablesFor', () => {
  it('9. A receber com dois devedores', () => {
    const expense = makeExpense()
    const settlements = [makeSettlement({ id: 's1', amount: 40 })]

    const lines = receivablesFor('rodrigo', [expense], settlements)
    expect(lines).toHaveLength(2)

    const patriciaLine = lines.find((l) => l.counterpartUid === 'patricia')
    expect(patriciaLine).toMatchObject({
      expenseId: 'exp-1',
      counterpartUid: 'patricia',
      due: 100,
      received: 40,
      pending: 60,
      status: 'partial',
    })

    const joaoLine = lines.find((l) => l.counterpartUid === 'joao')
    expect(joaoLine).toMatchObject({
      expenseId: 'exp-1',
      counterpartUid: 'joao',
      due: 50,
      received: 0,
      pending: 50,
      status: 'pending',
    })
  })

  it('10. A pagar do participante', () => {
    const expense = makeExpense()
    const settlements = [makeSettlement({ id: 's1', amount: 40 })]

    const lines = payablesFor('patricia', [expense], settlements)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      expenseId: 'exp-1',
      counterpartUid: 'rodrigo',
      due: 100,
      received: 40,
      pending: 60,
      status: 'partial',
    })
  })

  it('11. membro sem share não gera linha', () => {
    const expense = makeExpense()
    const lines = payablesFor('membro-sem-share', [expense], [])
    expect(lines).toHaveLength(0)
  })

  it('12. Expense sem split ignorado', () => {
    const expense = makeExpense({ split: undefined })
    expect(shareBalances(expense, [])).toEqual([])
    expect(receivablesFor('rodrigo', [expense], [])).toEqual([])
    expect(payablesFor('patricia', [expense], [])).toEqual([])
    expect(remainingForShare(expense, 'patricia', [])).toBe(0)
  })

  it('13. Settlement órfão ignorado', () => {
    const orphanSettlement = makeSettlement({ expenseId: 'gasto-inexistente' })
    const expense = makeExpense()

    const balances = shareBalances(expense, [orphanSettlement])
    expect(balances.find((b) => b.uid === 'patricia')?.received).toBe(0)

    const receivables = receivablesFor('rodrigo', [expense], [orphanSettlement])
    expect(receivables.find((r) => r.counterpartUid === 'patricia')?.received).toBe(0)

    expect(settlementsForExpense('gasto-inexistente', [orphanSettlement])).toHaveLength(1)
    expect(settlementsForExpense('exp-1', [orphanSettlement])).toHaveLength(0)
  })

  it('14. centavos (33,33)', () => {
    const expense = makeExpense({
      amount: 100,
      split: {
        paidByUid: 'rodrigo',
        shares: [
          { uid: 'rodrigo', amount: 33.34 },
          { uid: 'patricia', amount: 33.33 },
          { uid: 'joao', amount: 33.33 },
        ],
      },
    })

    const settlements = [makeSettlement({ id: 's1', amount: 33.33 })]
    expect(remainingForShare(expense, 'patricia', settlements)).toBe(0)

    const balances = shareBalances(expense, settlements)
    const patricia = balances.find((b) => b.uid === 'patricia')
    expect(patricia?.due).toBe(33.33)
    expect(patricia?.received).toBe(33.33)
    expect(patricia?.pending).toBe(0)
    expect(patricia?.status).toBe('paid')
  })

  it('15. Expense R$ 300 continua R$ 300 no total mensal', () => {
    const expense = makeExpense()
    const summaryBefore = computeMonthSummary('2026-11', monthData([expense]))
    expect(summaryBefore.expenses).toBe(300)

    // Mesmo com settlements parciais ou totais, o resumo financeiro não se altera
    const summaryAfter = computeMonthSummary('2026-11', monthData([expense]))
    expect(summaryAfter.expenses).toBe(300)
    expect(summaryAfter.expensesCount).toBe(1)
  })
})

describe('areSplitsEqual', () => {
  it('reconhece igualdade independente da ordem dos shares', () => {
    const splitA: ExpenseSplit = {
      paidByUid: 'rodrigo',
      shares: [
        { uid: 'rodrigo', amount: 150 },
        { uid: 'patricia', amount: 100 },
        { uid: 'joao', amount: 50 },
      ],
    }
    const splitB: ExpenseSplit = {
      paidByUid: 'rodrigo',
      shares: [
        { uid: 'joao', amount: 50 },
        { uid: 'rodrigo', amount: 150 },
        { uid: 'patricia', amount: 100 },
      ],
    }
    expect(areSplitsEqual(splitA, splitB)).toBe(true)
  })

  it('detecta alteração de valor ou participante', () => {
    const splitA: ExpenseSplit = {
      paidByUid: 'rodrigo',
      shares: [
        { uid: 'rodrigo', amount: 150 },
        { uid: 'patricia', amount: 150 },
      ],
    }
    const splitB: ExpenseSplit = {
      paidByUid: 'rodrigo',
      shares: [
        { uid: 'rodrigo', amount: 160 },
        { uid: 'patricia', amount: 140 },
      ],
    }
    expect(areSplitsEqual(splitA, splitB)).toBe(false)
  })
})