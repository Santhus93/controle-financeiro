import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase/firebase'
import type { InvoiceSummary, SaveInvoiceResult, SavedInvoice } from '../types/Invoice'
import type { Transaction } from '../types/Transaction'
import { getInvoiceMonth } from '../utils/invoiceReference'

const FIRESTORE_BATCH_LIMIT = 450

type BatchOperation = (batch: ReturnType<typeof writeBatch>) => void

function invoicesCollection(uid: string) {
  return collection(db, 'users', uid, 'invoices')
}

function invoiceDocument(uid: string, invoiceId: string) {
  return doc(db, 'users', uid, 'invoices', invoiceId)
}

function transactionsCollection(uid: string, invoiceId: string) {
  return collection(db, 'users', uid, 'invoices', invoiceId, 'transactions')
}

function normalizeForFingerprint(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, ' ')
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function getReferenceMonth(transactions: Transaction[]): string {
  const validDates = transactions
    .map((item) => item.date)
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort()

  if (!validDates.length) {
    throw new Error('Não foi possível determinar o mês de referência da fatura.')
  }

  return validDates[validDates.length - 1].slice(0, 7)
}

/**
 * Assinatura da fatura: data | descrição | valor de cada lançamento.
 * Não depende do formato do arquivo, então o mesmo conteúdo em CSV e em OFX
 * gera a mesma assinatura e não é duplicado.
 */
async function createInvoiceId(transactions: Transaction[]): Promise<string> {
  const canonicalTransactions = [...transactions]
    .map((item) => [item.date, normalizeForFingerprint(item.originalTitle), item.amount.toFixed(2)].join('|'))
    .sort()
    .join('\n')

  const fingerprint = await sha256(canonicalTransactions)
  return `${getReferenceMonth(transactions)}-${fingerprint.slice(0, 20)}`
}

function isExpense(transaction: Transaction): boolean {
  return ['purchase', 'installment', 'pix_credit'].includes(transaction.type) && transaction.amount > 0
}

function calculateTotals(transactions: Transaction[]) {
  return {
    totalExpenses: transactions
      .filter(isExpense)
      .reduce((total, item) => total + item.amount, 0),
    totalRefunds: Math.abs(
      transactions
        .filter((item) => item.type === 'refund')
        .reduce((total, item) => total + item.amount, 0),
    ),
    totalPayments: Math.abs(
      transactions
        .filter((item) => item.type === 'payment')
        .reduce((total, item) => total + item.amount, 0),
    ),
  }
}

function transactionToFirestore(transaction: Transaction) {
  return {
    id: transaction.id,
    date: transaction.date,
    title: transaction.title,
    originalTitle: transaction.originalTitle,
    amount: transaction.amount,
    type: transaction.type,
    category: transaction.category,
    ...(transaction.installment
      ? {
          installment: {
            current: transaction.installment.current,
            total: transaction.installment.total,
          },
        }
      : {}),
  }
}

function transactionFromFirestore(data: Record<string, unknown>): Transaction {
  const installment = data.installment as { current?: number; total?: number } | undefined

  return {
    id: String(data.id ?? ''),
    date: String(data.date ?? ''),
    title: String(data.title ?? ''),
    originalTitle: String(data.originalTitle ?? data.title ?? ''),
    amount: Number(data.amount ?? 0),
    type: data.type as Transaction['type'],
    category: data.category as Transaction['category'],
    ...(installment?.current && installment?.total
      ? { installment: { current: installment.current, total: installment.total } }
      : {}),
  }
}

function summaryFromSnapshot(id: string, data: Record<string, unknown>): InvoiceSummary {
  const importedAt = data.importedAt

  return {
    id,
    referenceMonth: getInvoiceMonth(
      String(data.fileName ?? ''),
      String(data.referenceMonth ?? ''),
    ),
    fileName: String(data.fileName ?? ''),
    card: String(data.card ?? 'Nubank'),
    transactionCount: Number(data.transactionCount ?? 0),
    totalExpenses: Number(data.totalExpenses ?? 0),
    totalRefunds: Number(data.totalRefunds ?? 0),
    totalPayments: Number(data.totalPayments ?? 0),
    importedAt: importedAt instanceof Timestamp ? importedAt.toDate() : null,
  }
}

async function commitInChunks(operations: BatchOperation[]): Promise<void> {
  for (let start = 0; start < operations.length; start += FIRESTORE_BATCH_LIMIT) {
    const batch = writeBatch(db)
    operations.slice(start, start + FIRESTORE_BATCH_LIMIT).forEach((operation) => operation(batch))
    await batch.commit()
  }
}

export async function saveInvoice(
  uid: string,
  fileName: string,
  transactions: Transaction[],
  card = 'Nubank',
): Promise<SaveInvoiceResult> {
  if (!transactions.length) {
    throw new Error('Não há lançamentos para salvar.')
  }

  const invoiceId = await createInvoiceId(transactions)
  const invoiceRef = invoiceDocument(uid, invoiceId)
  const existingInvoice = await getDoc(invoiceRef)

  if (existingInvoice.exists()) {
    return {
      invoice: await loadInvoice(uid, invoiceId),
      alreadyExisted: true,
    }
  }

  const referenceMonth = getInvoiceMonth(fileName, getReferenceMonth(transactions))
  const totals = calculateTotals(transactions)
  const operations: BatchOperation[] = []

  operations.push((batch) => {
    batch.set(invoiceRef, {
      referenceMonth,
      fileName,
      card,
      transactionCount: transactions.length,
      ...totals,
      importedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })

  transactions.forEach((transaction) => {
    const transactionRef = doc(transactionsCollection(uid, invoiceId), transaction.id)
    operations.push((batch) => batch.set(transactionRef, transactionToFirestore(transaction)))
  })

  await commitInChunks(operations)

  return {
    alreadyExisted: false,
    invoice: {
      id: invoiceId,
      referenceMonth,
      fileName,
      card,
      transactionCount: transactions.length,
      ...totals,
      importedAt: new Date(),
      transactions,
    },
  }
}

export async function listInvoices(uid: string): Promise<InvoiceSummary[]> {
  const invoicesQuery = query(invoicesCollection(uid), orderBy('importedAt', 'desc'))
  const snapshot = await getDocs(invoicesQuery)

  return snapshot.docs
    .map((invoiceSnapshot) => summaryFromSnapshot(invoiceSnapshot.id, invoiceSnapshot.data()))
    .sort((a, b) => b.referenceMonth.localeCompare(a.referenceMonth))
}

export async function loadInvoice(uid: string, invoiceId: string): Promise<SavedInvoice> {
  const invoiceSnapshot = await getDoc(invoiceDocument(uid, invoiceId))

  if (!invoiceSnapshot.exists()) {
    throw new Error('A fatura selecionada não foi encontrada.')
  }

  const transactionSnapshots = await getDocs(transactionsCollection(uid, invoiceId))
  const transactions = transactionSnapshots.docs
    .map((transactionSnapshot) => transactionFromFirestore(transactionSnapshot.data()))
    .sort((a, b) => b.date.localeCompare(a.date))

  return {
    ...summaryFromSnapshot(invoiceSnapshot.id, invoiceSnapshot.data()),
    transactions,
  }
}

export async function deleteInvoice(uid: string, invoiceId: string): Promise<void> {
  const transactionSnapshots = await getDocs(transactionsCollection(uid, invoiceId))
  const deleteOperations: BatchOperation[] = transactionSnapshots.docs.map(
    (transactionSnapshot) => (batch) => {
      batch.delete(transactionSnapshot.ref)
    },
  )

  await commitInChunks(deleteOperations)
  await deleteDoc(invoiceDocument(uid, invoiceId))
}

export async function updateTransactionCategory(
  uid: string,
  invoiceId: string,
  transactionId: string,
  category: Transaction['category'],
): Promise<void> {
  await updateTransactionsCategory(uid, invoiceId, [transactionId], category)
}

export async function updateTransactionsCategory(
  uid: string,
  invoiceId: string,
  transactionIds: string[],
  category: Transaction['category'],
): Promise<void> {
  if (!transactionIds.length) return

  const operations: BatchOperation[] = transactionIds.map((transactionId) => (batch) => {
    batch.update(doc(transactionsCollection(uid, invoiceId), transactionId), { category })
  })

  operations.push((batch) => {
    batch.update(invoiceDocument(uid, invoiceId), { updatedAt: serverTimestamp() })
  })

  await commitInChunks(operations)
}

/** Carrega todas as faturas com os lançamentos, da mais antiga para a mais recente. */
export async function loadAllInvoices(uid: string): Promise<SavedInvoice[]> {
  const summaries = await listInvoices(uid)
  const invoices = await Promise.all(summaries.map((summary) => loadInvoice(uid, summary.id)))
  return invoices.sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth))
}
