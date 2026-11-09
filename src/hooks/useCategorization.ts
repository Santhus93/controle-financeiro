import type { Dispatch, SetStateAction } from 'react'
import type { ToastType } from '../contexts/UiContext'
import { merchantKey, type CategoryRuleMap } from '../services/categoryEngine'
import { sortRules, type CategoryRule } from '../services/categoryRulesService'
import { updateTransactionsCategory } from '../services/firestoreService'
import type { Transaction, TransactionCategory } from '../types/Transaction'
import { getErrorMessage } from '../utils/errors'

interface UseCategorizationParams {
  root: string
  toast: (message: string, type?: ToastType) => void
  transactions: Transaction[]
  setTransactions: Dispatch<SetStateAction<Transaction[]>>
  selectedInvoiceId: string
  ruleMap: CategoryRuleMap
  setRules: Dispatch<SetStateAction<CategoryRule[]>>
  setSavingRule: (saving: boolean) => void
  saveRule: (title: string, category: TransactionCategory) => Promise<CategoryRule>
}

/**
 * Troca de categoria dos lançamentos e regras de estabelecimento.
 * A regra vale para todos os lançamentos do mesmo estabelecimento (merchantKey)
 * e é salva no Firestore para os próximos meses.
 */
export function useCategorization({
  root,
  toast,
  transactions,
  setTransactions,
  selectedInvoiceId,
  ruleMap,
  setRules,
  setSavingRule,
  saveRule,
}: UseCategorizationParams) {
  const notifyError = (cause: unknown) => toast(getErrorMessage(cause), 'error')

  /**
   * Salva a regra do estabelecimento no Firestore e atualiza
   * todos os lançamentos do mesmo estabelecimento na fatura aberta.
   */
  const applyCategoryToMerchant = async (title: string, category: TransactionCategory) => {
    if (!root) return

    const key = merchantKey(title)
    const affected = transactions.filter((item) => merchantKey(item.originalTitle) === key)

    setTransactions((current) =>
      current.map((item) => (merchantKey(item.originalTitle) === key ? { ...item, category } : item)),
    )

    setSavingRule(true)

    try {
      const rule = await saveRule(title, category)
      setRules((current) => sortRules([...current.filter((item) => item.id !== rule.id), rule]))

      if (selectedInvoiceId && affected.length) {
        await updateTransactionsCategory(
          root,
          selectedInvoiceId,
          affected.map((item) => item.id),
          category,
        )
      }

      toast(`${affected.length} lançamento(s) de "${affected[0]?.title ?? title}" agora em ${category}.`)
    } catch (cause) {
      notifyError(cause)
    } finally {
      setSavingRule(false)
    }
  }

  const handleCategoryChange = (id: string, category: TransactionCategory) => {
    const transaction = transactions.find((item) => item.id === id)
    if (transaction) void applyCategoryToMerchant(transaction.originalTitle, category)
  }

  const handleRuleChange = (rule: CategoryRule, category: TransactionCategory) => {
    void applyCategoryToMerchant(rule.sampleTitle, category)
  }

  const handleReapplyRules = async () => {
    if (!root || !selectedInvoiceId) return

    const changes = transactions
      .map((item) => ({ item, ruleCategory: ruleMap[merchantKey(item.originalTitle)] }))
      .filter(({ item, ruleCategory }) => ruleCategory && ruleCategory !== item.category)

    if (!changes.length) {
      toast('A fatura já está de acordo com as regras.', 'info')
      return
    }

    setSavingRule(true)

    try {
      const byCategory = new Map<TransactionCategory, string[]>()
      changes.forEach(({ item, ruleCategory }) => {
        const ids = byCategory.get(ruleCategory) ?? []
        ids.push(item.id)
        byCategory.set(ruleCategory, ids)
      })

      for (const [category, ids] of byCategory) {
        await updateTransactionsCategory(root, selectedInvoiceId, ids, category)
      }

      setTransactions((current) =>
        current.map((item) => {
          const ruleCategory = ruleMap[merchantKey(item.originalTitle)]
          return ruleCategory ? { ...item, category: ruleCategory } : item
        }),
      )
      toast(`${changes.length} lançamento(s) atualizado(s) pelas regras.`)
    } catch (cause) {
      notifyError(cause)
    } finally {
      setSavingRule(false)
    }
  }

  return {
    applyCategoryToMerchant,
    handleCategoryChange,
    handleRuleChange,
    handleReapplyRules,
  }
}
