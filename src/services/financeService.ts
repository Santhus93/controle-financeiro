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
import type { Bill, BillCategory, BillPayment, Income, NewBill, NewIncome } from '../types/Finance'

function userCollection(uid: string, name: 'bills' | 'billPayments' | 'incomes') {
  return collection(db, 'users', uid, name)
}

// ---------- Contas fixas ----------

export async function listBills(uid: string): Promise<Bill[]> {
  const snapshot = await getDocs(userCollection(uid, 'bills'))
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

export async function saveBill(uid: string, bill: NewBill): Promise<Bill> {
  const ref = bill.id ? doc(userCollection(uid, 'bills'), bill.id) : doc(userCollection(uid, 'bills'))
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
export async function deleteBill(uid: string, billId: string): Promise<void> {
  const payments = await getDocs(query(userCollection(uid, 'billPayments'), where('billId', '==', billId)))
  const batch = writeBatch(db)
  payments.docs.forEach((item) => batch.delete(item.ref))
  batch.delete(doc(userCollection(uid, 'bills'), billId))
  await batch.commit()
}

// ---------- Pagamentos do mês ----------

export async function listBillPayments(uid: string): Promise<BillPayment[]> {
  const snapshot = await getDocs(userCollection(uid, 'billPayments'))
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
  uid: string,
  billId: string,
  month: string,
  amount: number,
): Promise<BillPayment> {
  const id = `${month}_${billId}`
  await setDoc(doc(userCollection(uid, 'billPayments'), id), {
    billId,
    month,
    amount,
    paidAt: serverTimestamp(),
  })
  return { id, billId, month, amount }
}

export async function unmarkBillPaid(uid: string, billId: string, month: string): Promise<void> {
  await deleteDoc(doc(userCollection(uid, 'billPayments'), `${month}_${billId}`))
}

// ---------- Receitas ----------

export async function listIncomes(uid: string): Promise<Income[]> {
  const snapshot = await getDocs(userCollection(uid, 'incomes'))
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

export async function saveIncome(uid: string, income: NewIncome): Promise<Income> {
  const ref = income.id
    ? doc(userCollection(uid, 'incomes'), income.id)
    : doc(userCollection(uid, 'incomes'))
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

export async function deleteIncome(uid: string, incomeId: string): Promise<void> {
  await deleteDoc(doc(userCollection(uid, 'incomes'), incomeId))
}
