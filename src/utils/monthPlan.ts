import type { Bill, BillPayment, Expense, Income } from '../types/Finance'
import type { InvoiceSummary, SavedInvoice } from '../types/Invoice'
import { addMonths } from './invoiceReference'

export function currentMonth(today = new Date()): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
}

export function todayIso(today = new Date()): string {
  return `${currentMonth(today)}-${String(today.getDate()).padStart(2, '0')}`
}

/** Quantidade de meses de "from" até "to" (AAAA-MM). */
export function monthsBetween(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split('-').map(Number)
  const [toYear, toMonth] = to.split('-').map(Number)
  return (toYear - fromYear) * 12 + (toMonth - fromMonth)
}

/** Data de vencimento no mês; dia 31 em fevereiro vira o último dia do mês. */
export function dueDateIn(month: string, day: number): Date {
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(year, monthNumber, 0).getDate()
  return new Date(year, monthNumber - 1, Math.min(Math.max(day, 1), lastDay))
}

export function formatDayMonth(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function billsForMonth(bills: Bill[], month: string): Bill[] {
  return bills
    .filter((bill) => bill.startMonth <= month)
    .sort((a, b) => a.dueDay - b.dueDay || a.name.localeCompare(b.name, 'pt-BR'))
}

export function incomesForMonth(incomes: Income[], month: string): Income[] {
  return incomes
    .filter((income) => (income.recurring ? income.month <= month : income.month === month))
    .sort((a, b) => a.day - b.day)
}

export function expensesForMonth(expenses: Expense[], month: string): Expense[] {
  return expenses
    .filter((expense) => expense.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function paymentsByBill(payments: BillPayment[], month: string): Map<string, BillPayment> {
  return new Map(
    payments.filter((payment) => payment.month === month).map((payment) => [payment.billId, payment]),
  )
}

export type BillStatus = 'paid' | 'overdue' | 'soon' | 'pending'

const SOON_DAYS = 5

export function billStatus(
  bill: Bill,
  month: string,
  payment: BillPayment | undefined,
  today = new Date(),
): BillStatus {
  if (payment) return 'paid'

  const due = dueDateIn(month, bill.dueDay)
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const days = Math.round((due.getTime() - startOfToday.getTime()) / 86_400_000)

  if (days < 0) return 'overdue'
  if (days <= SOON_DAYS) return 'soon'
  return 'pending'
}

/** Aceita "1.234,56", "1234,56" e "1234.56". */
export function parseMoneyInput(value: string): number {
  const text = value.trim()
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0
}

export function toMoneyInput(value: number): string {
  return value ? value.toFixed(2).replace('.', ',') : ''
}

// ---------- Resumo do mês (usado em Meu mês e no Histórico) ----------

export interface FinanceData {
  invoices: InvoiceSummary[]
  bills: Bill[]
  payments: BillPayment[]
  incomes: Income[]
  expenses: Expense[]
}

export interface MonthSummary {
  month: string
  income: number
  incomeCount: number
  /** Fatura que vence no mês: gastos − estornos. */
  card: number
  cardCount: number
  /** Contas fixas: valor pago ou, se ainda não paga, o valor fixo/estimado. */
  bills: number
  billsCount: number
  billsPaid: number
  billsPaidCount: number
  /** Gastos avulsos fora do cartão. */
  expenses: number
  expensesCount: number
  outflow: number
  leftover: number
  /** % da receita comprometida com saídas; null sem receita. */
  committed: number | null
}

export function invoiceNet(invoice: InvoiceSummary): number {
  return invoice.totalExpenses - invoice.totalRefunds
}

export function computeMonthSummary(month: string, data: FinanceData): MonthSummary {
  const monthIncomes = incomesForMonth(data.incomes, month)
  const monthInvoices = data.invoices.filter((invoice) => invoice.referenceMonth === month)
  const monthBills = billsForMonth(data.bills, month)
  const paid = paymentsByBill(data.payments, month)
  const monthExpenses = expensesForMonth(data.expenses, month)

  const income = monthIncomes.reduce((sum, item) => sum + item.amount, 0)
  const card = monthInvoices.reduce((sum, invoice) => sum + invoiceNet(invoice), 0)
  const bills = monthBills.reduce((sum, bill) => sum + (paid.get(bill.id)?.amount ?? bill.amount), 0)
  const billsPaid = monthBills.reduce((sum, bill) => sum + (paid.get(bill.id)?.amount ?? 0), 0)
  const expenses = monthExpenses.reduce((sum, item) => sum + item.amount, 0)
  const outflow = card + bills + expenses

  return {
    month,
    income,
    incomeCount: monthIncomes.length,
    card,
    cardCount: monthInvoices.length,
    bills,
    billsCount: monthBills.length,
    billsPaid,
    billsPaidCount: monthBills.filter((bill) => paid.has(bill.id)).length,
    expenses,
    expensesCount: monthExpenses.length,
    outflow,
    leftover: income - outflow,
    committed: income ? (outflow / income) * 100 : null,
  }
}

// ---------- Previsão ----------

export interface Forecast {
  month: string
  income: number
  bills: number
  /** Valor do cartão usado na previsão. */
  card: number
  /** true quando a fatura do mês já foi importada (valor real). */
  cardIsActual: boolean
  /** Parcelas já compradas que caem no mês. */
  installments: number
  /** Média dos gastos à vista no cartão (últimas faturas). */
  cardAverage: number
  /** Quantas faturas entraram na média. */
  averageBase: number
  expenses: number
  /** true quando os avulsos vieram da média dos últimos 3 meses. */
  expensesFromAverage: boolean
  leftover: number
}

const CASH_TYPES = ['purchase', 'pix_credit']

/**
 * Previsão de um mês futuro:
 * receitas − cartão previsto − contas fixas − gastos avulsos.
 * Cartão previsto = parcelas já compradas + média dos gastos à vista das últimas 3 faturas.
 * Se a fatura do mês já foi importada, usa o valor real.
 */
export function computeForecast(
  target: string,
  data: FinanceData,
  invoicesWithTransactions: SavedInvoice[],
): Forecast {
  const income = incomesForMonth(data.incomes, target).reduce((sum, item) => sum + item.amount, 0)

  const paid = paymentsByBill(data.payments, target)
  const bills = billsForMonth(data.bills, target).reduce(
    (sum, bill) => sum + (paid.get(bill.id)?.amount ?? bill.amount),
    0,
  )

  const previous = invoicesWithTransactions
    .filter((invoice) => invoice.referenceMonth < target)
    .sort((a, b) => b.referenceMonth.localeCompare(a.referenceMonth))

  // Parcelas: a fatura mais recente já mostra em que parcela cada compra está.
  let installments = 0
  const latest = previous[0]
  if (latest) {
    const distance = monthsBetween(latest.referenceMonth, target)
    latest.transactions.forEach((item) => {
      if (!item.installment || item.amount <= 0) return
      const remaining = item.installment.total - item.installment.current
      if (distance >= 1 && distance <= remaining) installments += item.amount
    })
  }

  const base = previous.slice(0, 3)
  const cardAverage = base.length
    ? base.reduce((sum, invoice) => {
        const cash = invoice.transactions
          .filter((item) => CASH_TYPES.includes(item.type) && item.amount > 0)
          .reduce((total, item) => total + item.amount, 0)
        const refunds = invoice.transactions
          .filter((item) => item.type === 'refund')
          .reduce((total, item) => total + Math.abs(item.amount), 0)
        return sum + cash - refunds
      }, 0) / base.length
    : 0

  const actualInvoices = data.invoices.filter((invoice) => invoice.referenceMonth === target)
  const cardIsActual = actualInvoices.length > 0
  const card = cardIsActual
    ? actualInvoices.reduce((sum, invoice) => sum + invoiceNet(invoice), 0)
    : installments + cardAverage

  const logged = expensesForMonth(data.expenses, target).reduce((sum, item) => sum + item.amount, 0)
  const expensesAverage =
    [1, 2, 3]
      .map((step) => addMonths(target, -step))
      .reduce(
        (sum, month) => sum + expensesForMonth(data.expenses, month).reduce((total, item) => total + item.amount, 0),
        0,
      ) / 3
  const expensesFromAverage = expensesAverage > logged
  const expenses = Math.max(logged, expensesAverage)

  return {
    month: target,
    income,
    bills,
    card,
    cardIsActual,
    installments,
    cardAverage,
    averageBase: base.length,
    expenses,
    expensesFromAverage,
    leftover: income - card - bills - expenses,
  }
}

/** Meses com algum dado financeiro, do primeiro ao atual (máximo de 12). */
export function monthsWithData(data: FinanceData, limit = 12): string[] {
  const candidates = [
    ...data.invoices.map((invoice) => invoice.referenceMonth),
    ...data.incomes.map((income) => income.month),
    ...data.bills.map((bill) => bill.startMonth),
    ...data.expenses.map((expense) => expense.date.slice(0, 7)),
  ].filter((month) => /^\d{4}-\d{2}$/.test(month))

  if (!candidates.length) return []

  const start = candidates.reduce((min, month) => (month < min ? month : min))
  const latestInvoice = data.invoices.reduce(
    (max, invoice) => (invoice.referenceMonth > max ? invoice.referenceMonth : max),
    '',
  )
  const now = currentMonth()
  const end = latestInvoice > now ? latestInvoice : now

  const months: string[] = []
  for (let month = start; month <= end; month = addMonths(month, 1)) months.push(month)
  return months.slice(-limit)
}
