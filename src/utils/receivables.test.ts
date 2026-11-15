import { describe, expect, it } from 'vitest'
import type { Receivable, ReceivablePayment } from '../types/Receivable'
import {
  receivableBalance,
  receivablePaymentsFor,
  sortReceivables,
  totalReceivableBalance,
} from './receivables'

const TODAY = '2026-12-21'

function makeReceivable(overrides: Partial<Receivable> = {}): Receivable {
  return {
    id: 'r1',
    description: 'Empréstimo',
    contact: { name: 'Carlos' },
    amount: 500,
    source: { type: 'manual' },
    ...overrides,
  }
}

function makePayment(overrides: Partial<ReceivablePayment> = {}): ReceivablePayment {
  return {
    id: 'p1',
    receivableId: 'r1',
    amount: 200,
    paymentDate: '2026-12-01',
    ...overrides,
  }
}

describe('saldo de uma cobrança', () => {
  it('1. sem pagamento fica pendente', () => {
    const balance = receivableBalance(makeReceivable(), [], TODAY)

    expect(balance).toEqual({
      receivableId: 'r1',
      due: 500,
      received: 0,
      pending: 500,
      status: 'pending',
    })
  })

  it('2. recebimento parcial fica parcial', () => {
    const balance = receivableBalance(makeReceivable(), [makePayment()], TODAY)

    expect(balance.received).toBe(200)
    expect(balance.pending).toBe(300)
    expect(balance.status).toBe('partial')
  })

  it('3. recebimento total fica pago', () => {
    const balance = receivableBalance(
      makeReceivable(),
      [makePayment({ amount: 500 })],
      TODAY,
    )

    expect(balance.received).toBe(500)
    expect(balance.pending).toBe(0)
    expect(balance.status).toBe('paid')
  })

  it('4. vencido sem pagamento fica atrasado', () => {
    const balance = receivableBalance(
      makeReceivable({ dueDate: '2026-12-20' }),
      [],
      TODAY,
    )

    expect(balance.pending).toBe(500)
    expect(balance.status).toBe('overdue')
  })

  it('5. vencido e parcialmente pago continua atrasado, mantendo os valores', () => {
    const balance = receivableBalance(
      makeReceivable({ dueDate: '2026-12-20' }),
      [makePayment()],
      TODAY,
    )

    expect(balance.received).toBe(200)
    expect(balance.pending).toBe(300)
    expect(balance.status).toBe('overdue')
  })

  it('6. múltiplos pagamentos são somados', () => {
    const balance = receivableBalance(
      makeReceivable(),
      [
        makePayment({ id: 'p1', amount: 150, paymentDate: '2026-12-01' }),
        makePayment({ id: 'p2', amount: 50, paymentDate: '2026-12-05' }),
      ],
      TODAY,
    )

    expect(balance.received).toBe(200)
    expect(balance.pending).toBe(300)
    expect(balance.status).toBe('partial')
  })

  it('7. pagamento acima do valor não gera pendente negativo', () => {
    const balance = receivableBalance(
      makeReceivable(),
      [makePayment({ amount: 600 })],
      TODAY,
    )

    expect(balance.pending).toBe(0)
    expect(balance.status).toBe('paid')
  })

  it('8. pagamento de outra cobrança é ignorado', () => {
    const balance = receivableBalance(
      makeReceivable(),
      [makePayment({ receivableId: 'outra' })],
      TODAY,
    )

    expect(balance.received).toBe(0)
    expect(balance.pending).toBe(500)
    expect(balance.status).toBe('pending')
  })

  it('9. pagamento órfão é ignorado no total consolidado', () => {
    const receivable = makeReceivable()
    const payments = [makePayment(), makePayment({ id: 'orfa', receivableId: 'sumiu' })]
    const totals = totalReceivableBalance([receivable], payments, TODAY)

    expect(totals).toEqual({ due: 500, received: 200, pending: 300 })
  })

  it('10. cálculos internos usam centavos', () => {
    const receivable = makeReceivable({ amount: 0.3 })
    const payments = [
      makePayment({ id: 'p1', amount: 0.1 }),
      makePayment({ id: 'p2', amount: 0.2 }),
    ]
    const balance = receivableBalance(receivable, payments, TODAY)

    expect(balance.received).toBe(0.3)
    expect(balance.pending).toBe(0)
    expect(balance.status).toBe('paid')

    const cents = receivableBalance(
      makeReceivable({ amount: 33.33 }),
      [makePayment({ amount: 11.11 }), makePayment({ id: 'p2', amount: 22.22 })],
      TODAY,
    )

    expect(cents.pending).toBe(0)
    expect(cents.status).toBe('paid')
  })

  it('11. sem vencimento nunca fica atrasado', () => {
    const balance = receivableBalance(
      makeReceivable(),
      [makePayment({ paymentDate: '2020-01-01' })],
      TODAY,
    )

    expect(balance.status).toBe('partial')
  })
})

describe('totais consolidados', () => {
  it('12. soma o total devido', () => {
    const totals = totalReceivableBalance(
      [makeReceivable(), makeReceivable({ id: 'r2', amount: 1500.5 })],
      [],
      TODAY,
    )

    expect(totals.due).toBe(2000.5)
  })

  it('13. soma o total recebido', () => {
    const totals = totalReceivableBalance(
      [makeReceivable(), makeReceivable({ id: 'r2', amount: 1000 })],
      [makePayment(), makePayment({ id: 'p2', receivableId: 'r2', amount: 400 })],
      TODAY,
    )

    expect(totals.received).toBe(600)
  })

  it('14. soma o total pendente', () => {
    const totals = totalReceivableBalance(
      [makeReceivable(), makeReceivable({ id: 'r2', amount: 1000 })],
      [makePayment(), makePayment({ id: 'p2', receivableId: 'r2', amount: 400 })],
      TODAY,
    )

    expect(totals.pending).toBe(900)
  })

  it('15. documento antigo sem campos opcionais não quebra', () => {
    const antiguo: Receivable = {
      id: 'antigo',
      description: 'Cobrança antiga',
      contact: { name: 'Ana' },
      amount: 120,
      source: { type: 'manual' },
    }
    const pagamentoAntigo: ReceivablePayment = {
      id: 'p-antigo',
      receivableId: 'antigo',
      amount: 20,
      paymentDate: '2026-01-10',
    }

    const balance = receivableBalance(antiguo, [pagamentoAntigo], TODAY)

    expect(balance.due).toBe(120)
    expect(balance.received).toBe(20)
    expect(balance.pending).toBe(100)
    expect(balance.status).toBe('partial')

    expect(totalReceivableBalance([antiguo], [pagamentoAntigo], TODAY)).toEqual({
      due: 120,
      received: 20,
      pending: 100,
    })
  })
})

describe('ordenação e agrupamento', () => {
  it('agrupa pagamentos da cobrança em ordem de data', () => {
    const payments = [
      makePayment({ id: 'p3', paymentDate: '2026-12-10' }),
      makePayment({ id: 'p1', paymentDate: '2026-12-01' }),
      makePayment({ id: 'p2', paymentDate: '2026-12-05' }),
      makePayment({ id: 'outra', receivableId: 'r2' }),
    ]

    expect(receivablePaymentsFor('r1', payments).map((p) => p.id)).toEqual(['p1', 'p2', 'p3'])
  })

  it('ordena cobranças por vencimento, sem vencimento por último', () => {
    const ordered = sortReceivables([
      makeReceivable({ id: 'sem-data' }),
      makeReceivable({ id: 'depois', dueDate: '2027-01-10' }),
      makeReceivable({ id: 'antes', dueDate: '2026-12-01' }),
    ])

    expect(ordered.map((r) => r.id)).toEqual(['antes', 'depois', 'sem-data'])
  })
})
