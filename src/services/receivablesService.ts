import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore'
import { db } from '../firebase/firebase'
import { createAuthorshipFields } from './authorship'
import type { Actor } from '../types/Author'
import type {
  NewReceivable,
  NewReceivablePayment,
  Receivable,
  ReceivableContact,
  ReceivablePayment,
  ReceivableSource,
} from '../types/Receivable'
import { optimisticAuthorship, readAuthorship } from '../utils/authorship'
import { formatCurrency } from '../utils/currency'
import {
  receivableBalance,
  receivablePaymentsFor,
  sortReceivables,
} from '../utils/receivables'
import { fromCents, toCents } from '../utils/split'

function receivablesCollection(root: string) {
  return collection(db, root, 'receivables')
}

function paymentsCollection(root: string) {
  return collection(db, root, 'receivablePayments')
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

/** Leitura tolerante da origem; documentos antigos viram cobrança manual. */
function readSource(value: unknown): ReceivableSource {
  if (value && typeof value === 'object') {
    const raw = value as Record<string, unknown>
    const invoiceId = typeof raw.invoiceId === 'string' ? raw.invoiceId.trim() : ''
    const transactionId =
      typeof raw.transactionId === 'string' ? raw.transactionId.trim() : ''

    return {
      type: raw.type === 'card_transaction' ? 'card_transaction' : 'manual',
      ...(invoiceId ? { invoiceId } : {}),
      ...(transactionId ? { transactionId } : {}),
    }
  }

  return { type: 'manual' }
}

function readContact(value: unknown): ReceivableContact | null {
  if (!value || typeof value !== 'object') return null

  const raw = value as Record<string, unknown>
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!name) return null

  const email = typeof raw.email === 'string' ? raw.email.trim() : ''
  const phone = typeof raw.phone === 'string' ? raw.phone.trim() : ''

  return {
    name,
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
  }
}

/**
 * Lista cobranças do escopo com leitura tolerante.
 * Documento inválido é ignorado sem derrubar a carga.
 */
export async function listReceivables(root: string): Promise<Receivable[]> {
  const snapshot = await getDocs(receivablesCollection(root))
  const list: Receivable[] = []

  for (const item of snapshot.docs) {
    const data = item.data()
    const description = typeof data.description === 'string' ? data.description.trim() : ''
    const contact = readContact(data.contact)
    const amount = Number(data.amount)

    if (!description || !contact || !Number.isFinite(amount) || amount <= 0) continue

    const dueDate =
      typeof data.dueDate === 'string' && isValidIsoDate(data.dueDate.trim())
        ? data.dueDate.trim()
        : undefined
    const notes = typeof data.notes === 'string' ? data.notes.trim() : ''

    list.push({
      id: item.id,
      description,
      contact,
      amount: fromCents(toCents(amount)),
      ...(dueDate ? { dueDate } : {}),
      ...(notes ? { notes } : {}),
      source: readSource(data.source),
      ...readAuthorship(data),
    })
  }

  return sortReceivables(list)
}

/**
 * Cria ou edita uma cobrança.
 * A autoria é gravada apenas na criação; o `source` nunca é reescrito depois.
 */
export async function saveReceivable(
  root: string,
  receivable: NewReceivable,
  actor?: Actor,
): Promise<Receivable> {
  const description = receivable.description.trim()
  if (description.length < 2) {
    throw new Error('Informe a descrição da cobrança.')
  }

  const name = receivable.contact.name.trim()
  if (name.length < 2) {
    throw new Error('Informe o nome da pessoa.')
  }

  if (!Number.isFinite(receivable.amount) || toCents(receivable.amount) <= 0) {
    throw new Error('O valor a receber precisa ser maior que zero.')
  }

  const dueDate = receivable.dueDate?.trim() ?? ''
  if (dueDate && !isValidIsoDate(dueDate)) {
    throw new Error('Informe um vencimento válido.')
  }

  const email = receivable.contact.email?.trim() ?? ''
  const phone = receivable.contact.phone?.trim() ?? ''
  const notes = receivable.notes?.trim() ?? ''
  const amountCents = toCents(receivable.amount)

  const contact: ReceivableContact = {
    name,
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
  }

  const base = {
    description,
    contact,
    amount: fromCents(amountCents),
    ...(dueDate ? { dueDate } : {}),
    ...(notes ? { notes } : {}),
  }

  if (receivable.id) {
    const payments = await listReceivablePayments(root)
    const receivedCents = receivablePaymentsFor(receivable.id, payments).reduce(
      (sum, payment) => sum + toCents(payment.amount),
      0,
    )

    if (amountCents < receivedCents) {
      throw new Error(
        `O valor não pode ser menor que o total já recebido (${formatCurrency(
          fromCents(receivedCents),
        )}).`,
      )
    }

    // `source` e autoria não são reenviados: o merge preserva o original.
    await setDoc(
      doc(receivablesCollection(root), receivable.id),
      {
        ...base,
        ...(dueDate ? {} : { dueDate: deleteField() }),
        ...(notes ? {} : { notes: deleteField() }),
      },
      { merge: true },
    )

    return {
      id: receivable.id,
      ...base,
      source: receivable.source ?? { type: 'manual' },
    }
  }

  const sourceType = receivable.source?.type ?? 'manual'
  if (sourceType !== 'manual') {
    throw new Error('Nesta versão, só é possível criar cobranças manuais.')
  }

  const source: ReceivableSource = { type: 'manual' }

  const ref = await addDoc(receivablesCollection(root), {
    ...base,
    source,
    ...createAuthorshipFields(actor),
  })

  return {
    id: ref.id,
    ...base,
    source,
    ...optimisticAuthorship(actor),
  }
}

/** Exclui uma cobrança sem recebimentos. */
export async function deleteReceivable(
  root: string,
  receivableId: string,
  currentPayments: ReceivablePayment[],
): Promise<void> {
  if (currentPayments.some((payment) => payment.receivableId === receivableId)) {
    throw new Error(
      'Este valor possui recebimentos. Desfaça os recebimentos antes de excluir.',
    )
  }

  await deleteDoc(doc(receivablesCollection(root), receivableId))
}

/** Lista recebimentos do escopo, em ordem determinística. */
export async function listReceivablePayments(root: string): Promise<ReceivablePayment[]> {
  const snapshot = await getDocs(paymentsCollection(root))
  const list: ReceivablePayment[] = []

  for (const item of snapshot.docs) {
    const data = item.data()
    const receivableId =
      typeof data.receivableId === 'string' ? data.receivableId.trim() : ''
    const amount = Number(data.amount)
    const paymentDate =
      typeof data.paymentDate === 'string' ? data.paymentDate.trim() : ''

    if (!receivableId || !Number.isFinite(amount) || amount <= 0) continue
    if (!isValidIsoDate(paymentDate)) continue

    const notes = typeof data.notes === 'string' ? data.notes.trim() : ''

    list.push({
      id: item.id,
      receivableId,
      amount: fromCents(toCents(amount)),
      paymentDate,
      ...(notes ? { notes } : {}),
      ...readAuthorship(data),
    })
  }

  return list.sort((a, b) => {
    if (a.paymentDate !== b.paymentDate) return a.paymentDate.localeCompare(b.paymentDate)

    const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : 0
    const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 0
    if (aTime !== bTime) return aTime - bTime

    return a.id.localeCompare(b.id)
  })
}

/**
 * Registra um recebimento. Imutável: não há edição de recebimento.
 * Não cria receita e não altera a cobrança.
 */
export async function createReceivablePayment(
  root: string,
  payment: NewReceivablePayment,
  receivable: Receivable,
  currentPayments: ReceivablePayment[],
  actor?: Actor,
): Promise<ReceivablePayment> {
  if (!receivable || !receivable.id) {
    throw new Error('Cobrança inválida ou não encontrada.')
  }

  if (!Number.isFinite(payment.amount) || toCents(payment.amount) <= 0) {
    throw new Error('O valor recebido precisa ser maior que zero.')
  }

  const paymentDate = payment.paymentDate.trim()
  if (!isValidIsoDate(paymentDate)) {
    throw new Error('Informe a data do recebimento.')
  }

  const pendingCents = toCents(
    receivableBalance(receivable, currentPayments).pending,
  )

  if (pendingCents <= 0) {
    throw new Error('Esta cobrança já está quitada.')
  }

  const amountCents = toCents(payment.amount)
  if (amountCents > pendingCents) {
    throw new Error(
      `O valor informado ultrapassa o pendente de ${formatCurrency(
        fromCents(pendingCents),
      )}.`,
    )
  }

  const notes = payment.notes?.trim() ?? ''
  const data = {
    receivableId: receivable.id,
    amount: fromCents(amountCents),
    paymentDate,
    ...(notes ? { notes } : {}),
  }

  const ref = await addDoc(paymentsCollection(root), {
    ...data,
    ...createAuthorshipFields(actor),
  })

  return {
    id: ref.id,
    ...data,
    ...optimisticAuthorship(actor),
  }
}

/** Exclui um recebimento (desfazer). */
export async function deleteReceivablePayment(
  root: string,
  paymentId: string,
): Promise<void> {
  await deleteDoc(doc(paymentsCollection(root), paymentId))
}
