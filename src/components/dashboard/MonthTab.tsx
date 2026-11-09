import { ExpensesPanel } from '../ExpensesPanel'
import { MonthOverview } from '../MonthOverview'
import type { Bill, BillPayment, Expense, Income, NewExpense } from '../../types/Finance'
import type { InvoiceSummary } from '../../types/Invoice'
import type { Forecast } from '../../utils/monthPlan'

interface MonthTabProps {
  month: string
  onMonthChange: (month: string) => void
  invoices: InvoiceSummary[]
  bills: Bill[]
  payments: BillPayment[]
  incomes: Income[]
  expenses: Expense[]
  forecast: Forecast | null
  saving: boolean
  onPay: (bill: Bill, amount: number) => void
  onUnpay: (bill: Bill) => void
  onOpenInvoice: (invoiceId: string) => void
  onManage: () => void
  onSaveExpense: (expense: NewExpense) => Promise<boolean>
  onDeleteExpense: (expense: Expense) => void
}

export function MonthTab({
  month,
  onMonthChange,
  invoices,
  bills,
  payments,
  incomes,
  expenses,
  forecast,
  saving,
  onPay,
  onUnpay,
  onOpenInvoice,
  onManage,
  onSaveExpense,
  onDeleteExpense,
}: MonthTabProps) {
  return (
    <MonthOverview
      month={month}
      onMonthChange={onMonthChange}
      invoices={invoices}
      bills={bills}
      payments={payments}
      incomes={incomes}
      expenses={expenses}
      forecast={forecast}
      saving={saving}
      onPay={onPay}
      onUnpay={onUnpay}
      onOpenInvoice={onOpenInvoice}
      onManage={onManage}
    >
      <ExpensesPanel
        month={month}
        expenses={expenses}
        saving={saving}
        onSave={onSaveExpense}
        onDelete={onDeleteExpense}
      />
    </MonthOverview>
  )
}
