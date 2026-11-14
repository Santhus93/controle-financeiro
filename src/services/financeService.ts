import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase/firebase'
import { createAuthorshipFields } from './authorship'
import type {
  Bill,
  BillCategory,
  BillPayment,
  Expense,
  ExpenseShare,
  ExpenseSplit,
  Income,
  NewBill,
  NewExpense,
  NewIncome,
  PaymentMethod,
} from '../types/Finance'
import type { Actor } from '../types/Author'
import type { TransactionCategory } from '../types/Transaction'
import { optimisticAuthorship, readAuthorship } from '../utils/authorship'
import type { Settlement } from '../types/Settlement'
import { areSplitsEqual, fromCents, toCents, validateExpenseSplit } from '../utils/split'

function rootCollection(root: string, name: 'bills' | 'billPayments' | 'incomes' | 'expenses') {
  return collection(db, root, name)
}

/**
 * Lê a divisão sem lançar erro: documento antigo ou campo inválido devolve
 * `undefined` e o gasto continua válido, apenas sem divisão.
 */
function readExpenseSplit(value: unknown): ExpenseSplit | undefined {
  if (!value || typeof value !== 'object') return undefined

  const raw = value as { paidByUid?: unknown; shares?: unknown }
  const paidByUid = typeof raw.paidByUid === 'string' ? raw.paidByUid.trim() : ''
  if (!paidByUid || !Array.isArray(raw.shares) || raw.shares.length < 2) return undefined

  const shares: ExpenseShare[] = []

  for (const item of raw.shares) {
    if (!item || typeof item !== 'object') return undefined

    const share = item as { uid?: unknown; name?: unknown; email?: unknown; amount?: unknown }
    const uid = typeof share.uid === 'string' ? share.uid.trim() : ''
    const amount = Number(share.amount)

    if (!uid || !Number.isFinite(amount) || amount <= 0) return undefined

    const name = typeof share.name === 'string' ? share.name.trim() : ''
    const email = typeof share.email === 'string' ? share.email.trim() : ''

    shares.push({
      uid,
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
      amount,
    })
  }

  return { paidByUid, shares }
}

/** Normaliza a divisão para gravação: valores em centavos, sem campos `undefined`. */
function normalizeExpenseSplit(split: ExpenseSplit): ExpenseSplit {
  return {
    paidByUid: split.paidByUid.trim(),
    shares: split.shares.map((share) => {
      const name = typeof share.name === 'string' ? share.name.trim() : ''
      const email = typeof share.email === 'string' ? share.email.trim() : ''

      return {
        uid: share.uid.trim(),
        ...(name ? { name } : {}),
        ...(email ? { email } : {}),
        amount: fromCents(toCents(share.amount)),
      }
    }),
  }
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
      ...readAuthorship(data),
    }
  })
}

export async function saveBill(root: string, bill: NewBill, actor?: Actor): Promise<Bill> {
  const editing = Boolean(bill.id)
  const ref = bill.id ? doc(rootCollection(root, 'bills'), bill.id) : doc(rootCollection(root, 'bills'))
  const data = {
    name: bill.name.trim(),
    category: bill.category,
    dueDay: Math.min(Math.max(Math.round(bill.dueDay), 1), 31),
    amount: bill.amount,
    variable: bill.variable,
    startMonth: bill.startMonth,
  }

  if (editing) {
    // Edição: merge preserva createdBy/createdAt do documento original.
    await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true })
    return { id: ref.id, ...data }
  }

  await setDoc(ref, { ...data, updatedAt: serverTimestamp(), ...createAuthorshipFields(actor) })
  return { id: ref.id, ...data, ...optimisticAuthorship(actor) }
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
      ...readAuthorship(data),
    }
  })
}

export async function markBillPaid(
  root: string,
  billId: string,
  month: string,
  amount: number,
  actor?: Actor,
): Promise<BillPayment> {
  const id = `${month}_${billId}`
  await setDoc(doc(rootCollection(root, 'billPayments'), id), {
    billId,
    month,
    amount,
    paidAt: serverTimestamp(),
    ...createAuthorshipFields(actor),
  })
  return { id, billId, month, amount, ...optimisticAuthorship(actor) }
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
      ...readAuthorship(data),
    }
  })
}

export async function saveIncome(root: string, income: NewIncome, actor?: Actor): Promise<Income> {
  const editing = Boolean(income.id)
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

  if (editing) {
    // Edição: merge preserva createdBy/createdAt do documento original.
    await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true })
    return { id: ref.id, ...data }
  }

  await setDoc(ref, { ...data, updatedAt: serverTimestamp(), ...createAuthorshipFields(actor) })
  return { id: ref.id, ...data, ...optimisticAuthorship(actor) }
}

export async function deleteIncome(root: string, incomeId: string): Promise<void> {
  await deleteDoc(doc(rootCollection(root, 'incomes'), incomeId))
}

// ---------- Gastos avulsos ----------

export async function listExpenses(root: string): Promise<Expense[]> {
  const snapshot = await getDocs(rootCollection(root, 'expenses'))
  return snapshot.docs.map((item) => {
    const data = item.data()
    const split = readExpenseSplit(data.split)
    return {
      id: item.id,
      description: String(data.description ?? ''),
      amount: Number(data.amount ?? 0),
      date: String(data.date ?? ''),
      category: (data.category ?? 'Outros') as TransactionCategory,
      method: (data.method ?? 'Pix') as PaymentMethod,
      ...(split ? { split } : {}),
      ...readAuthorship(data),
    }
  })
}

export async function saveExpense(
  root: string,
  expense: NewExpense,
  actor?: Actor,
  allowedMemberUids: string[] = [],
  currentSettlements: Settlement[] = [],
  existingExpense?: Expense,
): Promise<Expense> {
  const editing = Boolean(expense.id)

  if (editing && expense.id) {
    const hasSettlements = currentSettlements.some((s) => s.expenseId === expense.id)
    if (hasSettlements && existingExpense) {
      const amountChanged = toCents(expense.amount) !== toCents(existingExpense.amount)
      const dateChanged = expense.date !== existingExpense.date
      const splitChanged = !areSplitsEqual(expense.split, existingExpense.split)

      if (amountChanged || dateChanged || splitChanged) {
        throw new Error(
          'Este gasto já possui acertos. Desfaça os acertos antes de alterar a divisão, o valor ou a data.',
        )
      }
    }
  }

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

  let split: ExpenseSplit | undefined
  if (expense.split) {
    // O serviço revalida: a interface não é a única garantia.
    const validation = validateExpenseSplit(expense.amount, expense.split, allowedMemberUids)
    if (!validation.valid) throw new Error(validation.message)
    split = normalizeExpenseSplit(expense.split)
  }

  if (editing) {
    // Edição: merge preserva createdBy/createdAt do documento original.
    // Sem divisão, `deleteField()` remove uma divisão antiga do documento.
    await setDoc(
      ref,
      { ...data, ...(split ? { split } : { split: deleteField() }), updatedAt: serverTimestamp() },
      { merge: true },
    )
    return { id: ref.id, ...data, ...(split ? { split } : {}) }
  }

  await setDoc(ref, {
    ...data,
    ...(split ? { split } : {}),
    updatedAt: serverTimestamp(),
    ...createAuthorshipFields(actor),
  })
  return { id: ref.id, ...data, ...(split ? { split } : {}), ...optimisticAuthorship(actor) }
}

export async function deleteExpense(
  root: string,
  expenseId: string,
  currentSettlements: Settlement[] = [],
): Promise<void> {
  if (currentSettlements.some((s) => s.expenseId === expenseId)) {
    throw new Error('Este gasto possui acertos. Desfaça todos os acertos antes de excluir.')
  }
  await deleteDoc(doc(rootCollection(root, 'expenses'), expenseId))
}
