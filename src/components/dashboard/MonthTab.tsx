import { ExpensesPanel } from '../ExpensesPanel'
import { MonthOverview } from '../MonthOverview'
import { SettlementsPanel } from '../SettlementsPanel'
import type { Bill, BillPayment, Expense, Income, NewExpense } from '../../types/Finance'
import type { InvoiceSummary } from '../../types/Invoice'
import type { SpaceMember } from '../../types/Space'
import type { NewSettlement, Settlement } from '../../types/Settlement'
import type { Forecast } from '../../utils/monthPlan'

interface MonthTabProps {
  month: string
  onMonthChange: (month: string) => void
  invoices: InvoiceSummary[]
  bills: Bill[]
  payments: BillPayment[]
  incomes: Income[]
  expenses: Expense[]
  settlements?: Settlement[]
  forecast: Forecast | null
  saving: boolean
  canEdit?: boolean
  isShared?: boolean
  members?: SpaceMember[]
  currentUid?: string
  onCreateSettlement?: (expense: Expense, settlement: NewSettlement) => Promise<boolean>
  onDeleteSettlement?: (settlement: Settlement) => Promise<boolean>
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
  settlements = [],
  forecast,
  saving,
  canEdit = true,
  isShared = false,
  members = [],
  currentUid = '',
  onCreateSettlement,
  onDeleteSettlement,
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
      canEdit={canEdit}
      isShared={isShared}
      onPay={onPay}
      onUnpay={onUnpay}
      onOpenInvoice={onOpenInvoice}
      onManage={onManage}
    >
      <ExpensesPanel
        month={month}
        expenses={expenses}
        settlements={settlements}
        saving={saving}
        canEdit={canEdit}
        isShared={isShared}
        members={members}
        currentUid={currentUid}
        onSave={onSaveExpense}
        onDelete={onDeleteExpense}
      />
      {isShared && onCreateSettlement && onDeleteSettlement && (
        <SettlementsPanel
          currentUid={currentUid}
          expenses={expenses}
          settlements={settlements}
          members={members}
          canEdit={canEdit}
          isShared={isShared}
          onCreateSettlement={onCreateSettlement}
          onDeleteSettlement={onDeleteSettlement}
        />
      )}
    </MonthOverview>
  )
}
