import { describe, expect, it } from 'vitest'
import type { Expense, ExpenseSplit } from '../types/Finance'
import { computeMonthSummary, type FinanceData } from './monthPlan'
import {
  fromCents,
  splitEvenly,
  splitMemberLabel,
  toCents,
  validateExpenseSplit,
} from './split'

const MEMBERS = ['rodrigo', 'patricia', 'joao']

function splitOf(amounts: number[], paidByUid = 'rodrigo'): ExpenseSplit {
  return {
    paidByUid,
    shares: MEMBERS.slice(0, amounts.length).map((uid, index) => ({
      uid,
      amount: amounts[index],
    })),
  }
}

function monthData(expense: Expense): FinanceData {
  return { invoices: [], bills: [], payments: [], incomes: [], expenses: [expense] }
}

describe('toCents / fromCents', () => {
  it('trabalha em centavos sem erro de ponto flutuante', () => {
    expect(toCents(0.1 + 0.2)).toBe(30)
    expect(fromCents(3334)).toBe(33.34)
    expect(fromCents(250)).toBe(2.5)
  })
})

describe('splitEvenly', () => {
  it('divide R$ 100 entre 3 e coloca o centavo restante no primeiro', () => {
    expect(splitEvenly(100, MEMBERS)).toEqual({
      rodrigo: 33.34,
      patricia: 33.33,
      joao: 33.33,
    })
  })

  it('divide R$ 10 entre 4 em partes iguais', () => {
    expect(splitEvenly(10, ['a', 'b', 'c', 'd'])).toEqual({
      a: 2.5,
      b: 2.5,
      c: 2.5,
      d: 2.5,
    })
  })

  it('rejeita R$ 0,01 entre 2 porque uma parte ficaria zero', () => {
    expect(splitEvenly(0.01, ['a', 'b'])).toEqual({})
    expect(splitEvenly(0.02, ['a', 'b'])).toEqual({ a: 0.01, b: 0.01 })
  })

  it('devolve a soma exata em centavos', () => {
    const result = splitEvenly(99.99, ['a', 'b', 'c', 'd', 'e', 'f', 'g'])
    const sum = Object.values(result).reduce((total, value) => total + toCents(value), 0)
    expect(sum).toBe(9999)
  })

  it('mantém a ordem recebida e distribui o resto deterministicamente', () => {
    const result = splitEvenly(100, MEMBERS)
    expect(Object.keys(result)).toEqual(MEMBERS)
    expect(result.rodrigo).toBe(33.34)
  })
})

describe('validateExpenseSplit', () => {
  it('aceita uma divisão que fecha exatamente no total', () => {
    expect(validateExpenseSplit(300, splitOf([150, 100, 50]), MEMBERS)).toEqual({ valid: true })
  })

  it('recusa pagador fora do espaço', () => {
    const result = validateExpenseSplit(300, splitOf([150, 150], 'estranho'), MEMBERS)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.message).toContain('membro do espaço')
  })

  it('recusa pagador ausente dos shares', () => {
    const result = validateExpenseSplit(300, splitOf([150, 150], 'joao'), MEMBERS)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.message).toContain('participar da divisão')
  })

  it('recusa participante fora do espaço', () => {
    const split: ExpenseSplit = {
      paidByUid: 'rodrigo',
      shares: [
        { uid: 'rodrigo', amount: 150 },
        { uid: 'intruso', amount: 150 },
      ],
    }
    const result = validateExpenseSplit(300, split, MEMBERS)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.message).toContain('membros do espaço')
  })

  it('recusa uid duplicado', () => {
    const split: ExpenseSplit = {
      paidByUid: 'rodrigo',
      shares: [
        { uid: 'rodrigo', amount: 150 },
        { uid: 'rodrigo', amount: 150 },
      ],
    }
    const result = validateExpenseSplit(300, split, MEMBERS)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.message).toContain('mais de uma vez')
  })

  it('recusa share zero', () => {
    const result = validateExpenseSplit(300, splitOf([300, 0]), MEMBERS)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.message).toContain('maior que zero')
  })

  it('recusa share negativo', () => {
    const result = validateExpenseSplit(300, splitOf([350, -50]), MEMBERS)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.message).toContain('maior que zero')
  })

  it('recusa soma abaixo do total', () => {
    const result = validateExpenseSplit(300, splitOf([150, 100]), MEMBERS)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.message).toContain('igual ao total')
  })

  it('recusa soma acima do total', () => {
    const result = validateExpenseSplit(300, splitOf([150, 200]), MEMBERS)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.message).toContain('igual ao total')
  })

  it('recusa divisão com um único participante', () => {
    const result = validateExpenseSplit(300, splitOf([300]), MEMBERS)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.message).toContain('pelo menos 2')
  })
})

describe('compatibilidade com o Meu mês', () => {
  const base: Expense = {
    id: 'abc',
    description: 'Almoço com cliente',
    amount: 300,
    date: '2026-11-10',
    category: 'Alimentação',
    method: 'Pix',
  }

  it('gasto antigo sem split continua válido e conta uma vez', () => {
    expect(computeMonthSummary('2026-11', monthData(base)).expenses).toBe(300)
  })

  it('gasto dividido continua contando o amount uma única vez', () => {
    const divided: Expense = { ...base, split: splitOf([150, 100, 50]) }
    const summary = computeMonthSummary('2026-11', monthData(divided))
    expect(summary.expenses).toBe(300)
    expect(summary.expensesCount).toBe(1)
  })
})

describe('splitMemberLabel', () => {
  it('usa nome, senão e-mail, senão "Membro"', () => {
    expect(splitMemberLabel({ uid: 'a', name: 'Ana', email: 'ana@x.com', amount: 1 })).toBe('Ana')
    expect(splitMemberLabel({ uid: 'a', email: 'ana@x.com', amount: 1 })).toBe('ana@x.com')
    expect(splitMemberLabel({ uid: 'a', amount: 1 })).toBe('Membro')
    expect(splitMemberLabel({ uid: 'a', name: '  ', email: '  ', amount: 1 })).toBe('Membro')
  })
})
