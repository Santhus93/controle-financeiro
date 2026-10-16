import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase/firebase'
import type { TransactionCategory } from '../types/Transaction'

export interface Budget {
  /** Limite total da fatura. 0 = sem limite. */
  monthlyLimit: number
  /** Limite por categoria. Categorias ausentes não têm limite. */
  categories: Partial<Record<TransactionCategory, number>>
}

export const EMPTY_BUDGET: Budget = { monthlyLimit: 0, categories: {} }

function budgetDocument(uid: string) {
  return doc(db, 'users', uid, 'settings', 'budget')
}

function sanitize(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0
}

function cleanCategories(raw: Record<string, unknown>): Budget['categories'] {
  const categories: Budget['categories'] = {}
  Object.entries(raw).forEach(([category, limit]) => {
    const value = sanitize(limit)
    if (value > 0) categories[category as TransactionCategory] = value
  })
  return categories
}

export async function loadBudget(uid: string): Promise<Budget> {
  const snapshot = await getDoc(budgetDocument(uid))
  if (!snapshot.exists()) return EMPTY_BUDGET

  const data = snapshot.data()
  return {
    monthlyLimit: sanitize(data.monthlyLimit),
    categories: cleanCategories((data.categories ?? {}) as Record<string, unknown>),
  }
}

export async function saveBudget(uid: string, budget: Budget): Promise<Budget> {
  const clean: Budget = {
    monthlyLimit: sanitize(budget.monthlyLimit),
    categories: cleanCategories(budget.categories as Record<string, unknown>),
  }

  await setDoc(budgetDocument(uid), { ...clean, updatedAt: serverTimestamp() })
  return clean
}

export function hasBudget(budget: Budget): boolean {
  return budget.monthlyLimit > 0 || Object.keys(budget.categories).length > 0
}
