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
import { createSettlement, deleteSettlement } from '../services/settlementsService'
import {
  createReceivableFromTransaction,
  createReceivablePayment,
  deleteReceivable,
  deleteReceivablePayment,
  saveReceivable,
  type CardReceivableInput,
} from '../services/receivablesService'
import type {
  Bill,
  BillPayment,
  Expense,
  Income,
  NewBill,
  NewExpense,
  NewIncome,
} from '../types/Finance'
import type { Actor, Authorship } from '../types/Author'
import type { Transaction } from '../types/Transaction'
import type { NewSettlement, Settlement } from '../types/Settlement'
import type {
  NewReceivable,
  NewReceivablePayment,
  Receivable,
  ReceivablePayment,
} from '../types/Receivable'
import { getErrorMessage } from '../utils/errors'
import { withAuthorship } from '../utils/authorship'

interface UseFinanceParams {
  root: string
  month: string
  toast: (message: string, type?: ToastType) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
  actor?: Actor
  /** UIDs dos membros do espaço ativo; no Pessoal é vazio. */
  memberUids?: string[]
}

/**
 * Substitui o item na lista preservando a autoria já conhecida.
 * Na edição o serviço grava com merge e não devolve autoria.
 */
function replaceItem<T extends { id: string } & Authorship>(current: T[], saved: T): T[] {
  const previous = current.find((item) => item.id === saved.id)
  return [...current.filter((item) => item.id !== saved.id), withAuthorship(saved, previous)]
}

/**
 * Contas fixas, pagamentos, receitas, gastos avulsos e acertos entre membros.
 * Recebe `root` (caminho Firestore) por parâmetro para suportar tanto o
 * espaço pessoal (`users/{uid}`) quanto espaços compartilhados (`spaces/{id}`).
 */
export function useFinance({ root, month, toast, confirm, actor, memberUids = [] }: UseFinanceParams) {
  const [bills, setBills] = useState<Bill[]>([])
  const [payments, setPayments] = useState<BillPayment[]>([])
  const [incomes, setIncomes] = useState<Income[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [receivables, setReceivables] = useState<Receivable[]>([])
  const [receivablePayments, setReceivablePayments] = useState<ReceivablePayment[]>([])
  const [savingFinance, setSavingFinance] = useState(false)

  const notifyError = (cause: unknown) => toast(getErrorMessage(cause), 'error')

  /** Executa uma operação financeira com indicador de salvamento, aviso e tratamento de erro. */
  const runFinance = async (operation: () => Promise<void>, message: string): Promise<boolean> => {
    if (!root) return false

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
      const saved = await saveBill(root, bill, actor)
      setBills((current) => replaceItem(current, saved))
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
      await deleteBill(root, bill.id)
      setBills((current) => current.filter((item) => item.id !== bill.id))
      setPayments((current) => current.filter((item) => item.billId !== bill.id))
    }, `Conta "${bill.name}" excluída.`)
  }

  const handlePayBill = (bill: Bill, amount: number) =>
    void runFinance(async () => {
      const payment = await markBillPaid(root, bill.id, month, amount, actor)
      setPayments((current) => [...current.filter((item) => item.id !== payment.id), payment])
    }, `"${bill.name}" marcada como paga.`)

  const handleUnpayBill = (bill: Bill) =>
    void runFinance(async () => {
      await unmarkBillPaid(root, bill.id, month)
      setPayments((current) => current.filter((item) => !(item.billId === bill.id && item.month === month)))
    }, `Pagamento de "${bill.name}" desfeito.`)

  const handleSaveIncome = (income: NewIncome) =>
    runFinance(async () => {
      const saved = await saveIncome(root, income, actor)
      setIncomes((current) => replaceItem(current, saved))
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
      await deleteIncome(root, income.id)
      setIncomes((current) => current.filter((item) => item.id !== income.id))
    }, `Receita "${income.name}" excluída.`)
  }

  const handleSaveExpense = (expense: NewExpense) =>
    runFinance(async () => {
      const existing = expenses.find((item) => item.id === expense.id)
      const saved = await saveExpense(root, expense, actor, memberUids, settlements, existing)
      setExpenses((current) => replaceItem(current, saved))
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
      await deleteExpense(root, expense.id, settlements)
      setExpenses((current) => current.filter((item) => item.id !== expense.id))
    }, `Gasto "${expense.description}" excluído.`)
  }

  const handleCreateSettlement = (expense: Expense, settlement: NewSettlement) =>
    runFinance(async () => {
      const saved = await createSettlement(root, settlement, expense, settlements, actor)
      setSettlements((current) => [...current, saved])
    }, 'Acerto registrado.')

  const handleDeleteSettlement = async (settlement: Settlement) => {
    const ok = await confirm({
      title: 'Desfazer acerto',
      message: 'O registro deste acerto será excluído. O valor voltará a constar como pendente.',
      confirmLabel: 'Desfazer',
      danger: true,
    })
    if (!ok) return false

    return runFinance(async () => {
      await deleteSettlement(root, settlement.id)
      setSettlements((current) => current.filter((item) => item.id !== settlement.id))
    }, 'Acerto desfeito.')
  }

  const handleSaveReceivable = (receivable: NewReceivable) =>
    runFinance(async () => {
      const saved = await saveReceivable(root, receivable, actor)
      setReceivables((current) => replaceItem(current, saved))
    }, `Cobrança "${receivable.description.trim()}" salva.`)

  const handleDeleteReceivable = async (receivable: Receivable) => {
    const ok = await confirm({
      title: 'Excluir cobrança',
      message: `A cobrança "${receivable.description}" de ${receivable.contact.name} será apagada.`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return false

    return runFinance(async () => {
      await deleteReceivable(root, receivable.id, receivablePayments)
      setReceivables((current) => current.filter((item) => item.id !== receivable.id))
    }, `Cobrança "${receivable.description}" excluída.`)
  }

  const handleCreateReceivablePayment = (
    receivable: Receivable,
    payment: NewReceivablePayment,
  ) =>
    runFinance(async () => {
      const saved = await createReceivablePayment(
        root,
        payment,
        receivable,
        receivablePayments,
        actor,
      )
      setReceivablePayments((current) => [...current, saved])
    }, 'Recebimento registrado.')

  const handleCreateReceivableFromTransaction = (
    invoiceId: string,
    transaction: Transaction,
    input: CardReceivableInput,
  ) =>
    runFinance(async () => {
      const saved = await createReceivableFromTransaction(
        root,
        { invoiceId, transaction, ...input },
        receivables,
        actor,
      )
      setReceivables((current) => [...current, saved])
    }, `Cobrança de "${input.contact.name.trim()}" criada.`)

  const handleDeleteReceivablePayment = async (payment: ReceivablePayment) => {
    const ok = await confirm({
      title: 'Desfazer recebimento',
      message: 'O registro deste recebimento será excluído. O valor voltará a constar como pendente.',
      confirmLabel: 'Desfazer',
      danger: true,
    })
    if (!ok) return false

    return runFinance(async () => {
      await deleteReceivablePayment(root, payment.id)
      setReceivablePayments((current) => current.filter((item) => item.id !== payment.id))
    }, 'Recebimento desfeito.')
  }

  return {
    bills,
    payments,
    incomes,
    expenses,
    settlements,
    receivables,
    receivablePayments,
    savingFinance,
    handleSaveBill,
    handleDeleteBill,
    handlePayBill,
    handleUnpayBill,
    handleSaveIncome,
    handleDeleteIncome,
    handleSaveExpense,
    handleDeleteExpense,
    handleCreateSettlement,
    handleDeleteSettlement,
    handleSaveReceivable,
    handleDeleteReceivable,
    handleCreateReceivablePayment,
    handleDeleteReceivablePayment,
    handleCreateReceivableFromTransaction,
    setBills,
    setPayments,
    setIncomes,
    setExpenses,
    setSettlements,
    setReceivables,
    setReceivablePayments,
  }
}
