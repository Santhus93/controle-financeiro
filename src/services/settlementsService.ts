import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/firebase'
import { createAuthorshipFields } from './authorship'
import type { Actor } from '../types/Author'
import type { Expense } from '../types/Finance'
import type { NewSettlement, Settlement } from '../types/Settlement'
import { optimisticAuthorship, readAuthorship } from '../utils/authorship'
import {
  fromCents,
  remainingForShare,
  settlementsForExpense,
  toCents,
} from '../utils/split'

function rootCollection(root: string) {
  return collection(db, root, 'settlements')
}

/** Ordenação determinística: createdAt crescente e empate por id. */
function sortSettlements(list: Settlement[]): Settlement[] {
  return [...list].sort((a, b) => {
    const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : 0
    const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 0
    if (aTime !== bTime) return aTime - bTime
    return a.id.localeCompare(b.id)
  })
}

/**
 * Lista acertos de um espaço com leitura tolerante.
 * Documento corrompido ou sem campos obrigatórios é ignorado sem derrubar a lista.
 */
export async function listSettlements(root: string): Promise<Settlement[]> {
  const snapshot = await getDocs(rootCollection(root))
  const list: Settlement[] = []

  for (const item of snapshot.docs) {
    const data = item.data()
    const expenseId = typeof data.expenseId === 'string' ? data.expenseId.trim() : ''
    const fromUid = typeof data.fromUid === 'string' ? data.fromUid.trim() : ''
    const toUid = typeof data.toUid === 'string' ? data.toUid.trim() : ''
    const amount = Number(data.amount)

    if (!expenseId || !fromUid || !toUid || !Number.isFinite(amount) || amount <= 0) {
      continue
    }

    list.push({
      id: item.id,
      expenseId,
      fromUid,
      toUid,
      amount: fromCents(toCents(amount)),
      ...readAuthorship(data),
    })
  }

  return sortSettlements(list)
}

/** Filtra settlements pertencentes a um gasto específico. */
export function listSettlementsByExpense(
  settlements: Settlement[],
  expenseId: string,
): Settlement[] {
  return settlementsForExpense(expenseId, settlements)
}

/**
 * Cria um acerto para parte de um gasto dividido.
 *
 * Imutável: não há updateSettlement. Para corrigir, exclua e registre novamente.
 */
export async function createSettlement(
  root: string,
  settlement: NewSettlement,
  expense: Expense,
  currentSettlements: Settlement[],
  actor?: Actor,
): Promise<Settlement> {
  if (!expense || !expense.id) {
    throw new Error('Gasto avulso inválido ou não encontrado.')
  }

  const split = expense.split
  if (!split) {
    throw new Error('Este gasto não possui divisão entre membros.')
  }

  const fromUid = settlement.fromUid.trim()
  const toUid = settlement.toUid.trim()
  const share = split.shares.find((s) => s.uid === fromUid)

  if (!share) {
    throw new Error('O membro informado não participa da divisão deste gasto.')
  }

  if (fromUid === split.paidByUid) {
    throw new Error('Quem pagou o gasto não pode registrar acerto contra si mesmo.')
  }

  if (toUid !== split.paidByUid) {
    throw new Error('O acerto deve ser destinado a quem pagou o gasto.')
  }

  const amountCents = toCents(settlement.amount)
  if (amountCents <= 0) {
    throw new Error('O valor do acerto deve ser maior que zero.')
  }

  const remainingCents = toCents(remainingForShare(expense, fromUid, currentSettlements))
  if (remainingCents <= 0) {
    throw new Error('A parte deste membro já está quitada.')
  }

  if (amountCents > remainingCents) {
    throw new Error(
      `O valor informado ultrapassa o saldo pendente de ${fromCents(remainingCents).toLocaleString(
        'pt-BR',
        { style: 'currency', currency: 'BRL' },
      )}.`,
    )
  }

  const data = {
    expenseId: expense.id,
    fromUid,
    toUid,
    amount: fromCents(amountCents),
  }

  const ref = await addDoc(rootCollection(root), {
    ...data,
    updatedAt: serverTimestamp(),
    ...createAuthorshipFields(actor),
  })

  return {
    id: ref.id,
    ...data,
    ...optimisticAuthorship(actor),
  }
}

/** Exclui um acerto existente. Não altera o Expense correspondente. */
export async function deleteSettlement(root: string, settlementId: string): Promise<void> {
  await deleteDoc(doc(rootCollection(root), settlementId))
}
