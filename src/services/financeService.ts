import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase/firebase'
import type {
  Bill,
  BillCategory,
  BillPayment,
  Expense,
  Income,
  NewBill,
  NewExpense,
  NewIncome,
  PaymentMethod,
} from '../types/Finance'
import type { TransactionCategory } from '../types/Transaction'

function rootCollection(root: string, name: 'bills' | 'billPayments' | 'incomes' | 'expenses') {
  return collection(db, root, name)
}

// ---------- Contas fixas ----------

export async function listBills(root: string): Promise<Bill[]> {
  const snapshot = await getDocs(rootCollection(root, 'bills'))
  return snapshot.docs.map((item) => {
    const data = item.data()
    return {
      id: item.id,
      name: String(data.name ?? ''),
      category: (data.category ?? 'Outros') as BillCategory,
      dueDay: Number(data.dueDay ?? 1),
      amount: Number(data.amount ?? 0),
      variable: Boolean(data.variable),
      startMonth: String(data.startMonth ?? ''),
    }
  })
}

export async function saveBill(root: string, bill: NewBill): Promise<Bill> {
  const ref = bill.id ? doc(rootCollection(root, 'bills'), bill.id) : doc(rootCollection(root, 'bills'))
  const data = {
    name: bill.name.trim(),
    category: bill.category,
    dueDay: Math.min(Math.max(Math.round(bill.dueDay), 1), 31),
    amount: bill.amount,
    variable: bill.variable,
    startMonth: bill.startMonth,
  }

  await setDoc(ref, { ...data, updatedAt: serverTimestamp() })
  return { id: ref.id, ...data }
}

/** Exclui a conta e todos os pagamentos registrados dela. */
export async function deleteBill(root: string, billId: string): Promise<void> {
  const payments = await getDocs(query(rootCollection(root, 'billPayments'), where('billId', '==', billId)))
  const batch = writeBatch(db)
  payments.docs.forEach((item) => batch.delete(item.ref))
  batch.delete(doc(rootCollection(root, 'bills'), billId))
  await batch.commit()
}

// ---------- Pagamentos do mês ----------

export async function listBillPayments(root: string): Promise<BillPayment[]> {
  const snapshot = await getDocs(rootCollection(root, 'billPayments'))
  return snapshot.docs.map((item) => {
    const data = item.data()
    return {
      id: item.id,
      billId: String(data.billId ?? ''),
      month: String(data.month ?? ''),
      amount: Number(data.amount ?? 0),
    }
  })
}

export async function markBillPaid(
  root: string,
  billId: string,
  month: string,
  amount: number,
): Promise<BillPayment> {
  const id = `${month}_${billId}`
  await setDoc(doc(rootCollection(root, 'billPayments'), id), {
    billId,
    month,
    amount,
    paidAt: serverTimestamp(),
  })
  return { id, billId, month, amount }
}

export async function unmarkBillPaid(root: string, billId: string, month: string): Promise<void> {
  await deleteDoc(doc(rootCollection(root, 'billPayments'), `${month}_${billId}`))
}

// ---------- Receitas ----------

export async function listIncomes(root: string): Promise<Income[]> {
  const snapshot = await getDocs(rootCollection(root, 'incomes'))
  return snapshot.docs.map((item) => {
    const data = item.data()
    return {
      id: item.id,
      name: String(data.name ?? ''),
      amount: Number(data.amount ?? 0),
      recurring: Boolean(data.recurring),
      month: String(data.month ?? ''),
      day: Number(data.day ?? 1),
    }
  })
}

export async function saveIncome(root: string, income: NewIncome): Promise<Income> {
  const ref = income.id
    ? doc(rootCollection(root, 'incomes'), income.id)
    : doc(rootCollection(root, 'incomes'))
  const data = {
    name: income.name.trim(),
    amount: income.amount,
    recurring: income.recurring,
    month: income.month,
    day: Math.min(Math.max(Math.round(income.day), 1), 31),
  }

  await setDoc(ref, { ...data, updatedAt: serverTimestamp() })
  return { id: ref.id, ...data }
}

export async function deleteIncome(root: string, incomeId: string): Promise<void> {
  await deleteDoc(doc(rootCollection(root, 'incomes'), incomeId))
}

// ---------- Gastos avulsos ----------

export async function listExpenses(root: string): Promise<Expense[]> {
  const snapshot = await getDocs(rootCollection(root, 'expenses'))
  return snapshot.docs.map((item) => {
    const data = item.data()
    return {
      id: item.id,
      description: String(data.description ?? ''),
      amount: Number(data.amount ?? 0),
      date: String(data.date ?? ''),
      category: (data.category ?? 'Outros') as TransactionCategory,
      method: (data.method ?? 'Pix') as PaymentMethod,
    }
  })
}

export async function saveExpense(root: string, expense: NewExpense): Promise<Expense> {
  const ref = expense.id
    ? doc(rootCollection(root, 'expenses'), expense.id)
    : doc(rootCollection(root, 'expenses'))
  const data = {
    description: expense.description.trim(),
    amount: expense.amount,
    date: expense.date,
    category: expense.category,
    method: expense.method,
  }

  await setDoc(ref, { ...data, updatedAt: serverTimestamp() })
  return { id: ref.id, ...data }
}

export async function deleteExpense(root: string, expenseId: string): Promise<void> {
  await deleteDoc(doc(rootCollection(root, 'expenses'), expenseId))
}
