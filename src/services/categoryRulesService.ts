import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase/firebase'
import type { TransactionCategory } from '../types/Transaction'
import { merchantKey, type CategoryRuleMap } from './categoryEngine'

export interface CategoryRule {
  id: string
  pattern: string
  category: TransactionCategory
  sampleTitle: string
  updatedAt: Date | null
}

function rulesCollection(uid: string) {
  return collection(db, 'users', uid, 'categoryRules')
}

export function ruleIdFromPattern(pattern: string): string {
  return pattern.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'regra'
}

export function sortRules(rules: CategoryRule[]): CategoryRule[] {
  return [...rules].sort((a, b) => a.sampleTitle.localeCompare(b.sampleTitle, 'pt-BR'))
}

export async function listCategoryRules(uid: string): Promise<CategoryRule[]> {
  const snapshot = await getDocs(rulesCollection(uid))

  return sortRules(
    snapshot.docs.map((ruleSnapshot) => {
      const data = ruleSnapshot.data()
      return {
        id: ruleSnapshot.id,
        pattern: String(data.pattern ?? ''),
        category: data.category as TransactionCategory,
        sampleTitle: String(data.sampleTitle ?? data.pattern ?? ''),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null,
      }
    }),
  )
}

export function rulesToMap(rules: CategoryRule[]): CategoryRuleMap {
  return Object.fromEntries(rules.map((rule) => [rule.pattern, rule.category]))
}

export async function saveCategoryRule(
  uid: string,
  title: string,
  category: TransactionCategory,
): Promise<CategoryRule> {
  const pattern = merchantKey(title)

  if (!pattern) {
    throw new Error('Não foi possível identificar o estabelecimento para criar a regra.')
  }

  const id = ruleIdFromPattern(pattern)

  await setDoc(doc(rulesCollection(uid), id), {
    pattern,
    category,
    sampleTitle: title,
    updatedAt: serverTimestamp(),
  })

  return { id, pattern, category, sampleTitle: title, updatedAt: new Date() }
}

export async function deleteCategoryRule(uid: string, ruleId: string): Promise<void> {
  await deleteDoc(doc(rulesCollection(uid), ruleId))
}

/** Migra para o Firestore as regras antigas do localStorage (V1). */
export async function importLegacyRules(
  uid: string,
  legacyRules: CategoryRuleMap,
  existingRules: CategoryRuleMap,
): Promise<number> {
  const entries = Object.entries(legacyRules)
    .filter(([pattern]) => pattern && !existingRules[pattern])
    .slice(0, 450)

  if (!entries.length) return 0

  const batch = writeBatch(db)
  entries.forEach(([pattern, category]) => {
    batch.set(doc(rulesCollection(uid), ruleIdFromPattern(pattern)), {
      pattern,
      category,
      sampleTitle: pattern,
      updatedAt: serverTimestamp(),
    })
  })
  await batch.commit()

  return entries.length
}
