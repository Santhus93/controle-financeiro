import type { Bill, BillPayment, Income } from '../types/Finance'

export function currentMonth(today = new Date()): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
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
