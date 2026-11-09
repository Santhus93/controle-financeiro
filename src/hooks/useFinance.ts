import { useState } from 'react'
import type { ConfirmOptions, ToastType } from '../contexts/UiContext'
import {
  deleteBill,
  deleteExpense,
  deleteIncome,
  markBillPaid,
  saveBill,
  saveExpense,
  saveIncome,
  unmarkBillPaid,
} from '../services/financeService'
import type {
  Bill,
  BillPayment,
  Expense,
  Income,
  NewBill,
  NewExpense,
  NewIncome,
} from '../types/Finance'
import { getErrorMessage } from '../utils/errors'

interface UseFinanceParams {
  uid: string | undefined
  month: string
  toast: (message: string, type?: ToastType) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

/**
 * Contas fixas, pagamentos, receitas e gastos avulsos.
 * Recebe uid/toast/confirm por parâmetro para que o uid possa virar um
 * spaceId sem mexer no hook.
 */
export function useFinance({ uid, month, toast, confirm }: UseFinanceParams) {
  const [bills, setBills] = useState<Bill[]>([])
  const [payments, setPayments] = useState<BillPayment[]>([])
  const [incomes, setIncomes] = useState<Income[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [savingFinance, setSavingFinance] = useState(false)

  const notifyError = (cause: unknown) => toast(getErrorMessage(cause), 'error')

  /** Executa uma operação financeira com indicador de salvamento, aviso e tratamento de erro. */
  const runFinance = async (operation: () => Promise<void>, message: string): Promise<boolean> => {
    if (!uid) return false

    setSavingFinance(true)

    try {
      await operation()
      toast(message)
      return true
    } catch (cause) {
      notifyError(cause)
      return false
    } finally {
      setSavingFinance(false)
    }
  }

  const handleSaveBill = (bill: NewBill) =>
    runFinance(async () => {
      const saved = await saveBill(uid!, bill)
      setBills((current) => [...current.filter((item) => item.id !== saved.id), saved])
    }, `Conta "${bill.name.trim()}" salva.`)

  const handleDeleteBill = async (bill: Bill) => {
    const ok = await confirm({
      title: 'Excluir conta fixa',
      message: `A conta "${bill.name}" e todo o histórico de pagamentos dela serão apagados.`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return

    await runFinance(async () => {
      await deleteBill(uid!, bill.id)
      setBills((current) => current.filter((item) => item.id !== bill.id))
      setPayments((current) => current.filter((item) => item.billId !== bill.id))
    }, `Conta "${bill.name}" excluída.`)
  }

  const handlePayBill = (bill: Bill, amount: number) =>
    void runFinance(async () => {
      const payment = await markBillPaid(uid!, bill.id, month, amount)
      setPayments((current) => [...current.filter((item) => item.id !== payment.id), payment])
    }, `"${bill.name}" marcada como paga.`)

  const handleUnpayBill = (bill: Bill) =>
    void runFinance(async () => {
      await unmarkBillPaid(uid!, bill.id, month)
      setPayments((current) => current.filter((item) => !(item.billId === bill.id && item.month === month)))
    }, `Pagamento de "${bill.name}" desfeito.`)

  const handleSaveIncome = (income: NewIncome) =>
    runFinance(async () => {
      const saved = await saveIncome(uid!, income)
      setIncomes((current) => [...current.filter((item) => item.id !== saved.id), saved])
    }, `Receita "${income.name.trim()}" salva.`)

  const handleDeleteIncome = async (income: Income) => {
    const ok = await confirm({
      title: 'Excluir receita',
      message: `A receita "${income.name}" será apagada de todos os meses.`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return

    await runFinance(async () => {
      await deleteIncome(uid!, income.id)
      setIncomes((current) => current.filter((item) => item.id !== income.id))
    }, `Receita "${income.name}" excluída.`)
  }

  const handleSaveExpense = (expense: NewExpense) =>
    runFinance(async () => {
      const saved = await saveExpense(uid!, expense)
      setExpenses((current) => [...current.filter((item) => item.id !== saved.id), saved])
    }, `Gasto "${expense.description.trim()}" salvo.`)

  const handleDeleteExpense = async (expense: Expense) => {
    const ok = await confirm({
      title: 'Excluir gasto',
      message: `O gasto "${expense.description}" será apagado.`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return

    await runFinance(async () => {
      await deleteExpense(uid!, expense.id)
      setExpenses((current) => current.filter((item) => item.id !== expense.id))
    }, `Gasto "${expense.description}" excluído.`)
  }

  return {
    bills,
    payments,
    incomes,
    expenses,
    savingFinance,
    handleSaveBill,
    handleDeleteBill,
    handlePayBill,
    handleUnpayBill,
    handleSaveIncome,
    handleDeleteIncome,
    handleSaveExpense,
    handleDeleteExpense,
    setBills,
    setPayments,
    setIncomes,
    setExpenses,
  }
}
