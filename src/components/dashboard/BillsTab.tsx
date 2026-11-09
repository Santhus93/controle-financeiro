import { BillsManager } from '../BillsManager'
import type { Bill, Income, NewBill, NewIncome } from '../../types/Finance'

interface BillsTabProps {
  month: string
  bills: Bill[]
  incomes: Income[]
  saving: boolean
  onSaveBill: (bill: NewBill) => Promise<boolean>
  onDeleteBill: (bill: Bill) => void
  onSaveIncome: (income: NewIncome) => Promise<boolean>
  onDeleteIncome: (income: Income) => void
}

export function BillsTab({
  month,
  bills,
  incomes,
  saving,
  onSaveBill,
  onDeleteBill,
  onSaveIncome,
  onDeleteIncome,
}: BillsTabProps) {
  return (
    <BillsManager
      month={month}
      bills={bills}
      incomes={incomes}
      saving={saving}
      onSaveBill={onSaveBill}
      onDeleteBill={onDeleteBill}
      onSaveIncome={onSaveIncome}
      onDeleteIncome={onDeleteIncome}
    />
  )
}
