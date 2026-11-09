import { useMemo, useState } from 'react'
import type { ConfirmOptions, ToastType } from '../contexts/UiContext'
import {
  deleteCategoryRule,
  rulesToMap,
  saveCategoryRule,
  type CategoryRule,
} from '../services/categoryRulesService'
import type { TransactionCategory } from '../types/Transaction'
import { getErrorMessage } from '../utils/errors'

interface UseRulesParams {
  uid: string | undefined
  toast: (message: string, type?: ToastType) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

/**
 * Regras de categoria do usuário.
 * Não depende de transações: só guarda a lista, o mapa por estabelecimento e
 * as operações de gravar/excluir regra.
 */
export function useRules({ uid, toast, confirm }: UseRulesParams) {
  const [rules, setRules] = useState<CategoryRule[]>([])
  const [savingRule, setSavingRule] = useState(false)

  const ruleMap = useMemo(() => rulesToMap(rules), [rules])

  const notifyError = (cause: unknown) => toast(getErrorMessage(cause), 'error')

  /**
   * Grava a regra no Firestore e devolve a versão salva.
   * Quem chama decide quando atualizar a lista (setRules) e quando mostrar o aviso.
   */
  const saveRule = async (title: string, category: TransactionCategory) => {
    if (!uid) throw new Error('Sessão expirada.')

    return saveCategoryRule(uid, title, category)
  }

  const deleteRule = async (rule: CategoryRule) => {
    if (!uid) return

    const ok = await confirm({
      title: 'Excluir regra',
      message: `A regra "${rule.sampleTitle}" → ${rule.category} será excluída. Os lançamentos já categorizados não mudam.`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return

    setSavingRule(true)

    try {
      await deleteCategoryRule(uid, rule.id)
      setRules((current) => current.filter((item) => item.id !== rule.id))
      toast('Regra excluída.')
    } catch (cause) {
      notifyError(cause)
    } finally {
      setSavingRule(false)
    }
  }

  return {
    rules,
    savingRule,
    setSavingRule,
    ruleMap,
    setRules,
    saveRule,
    deleteRule,
  }
}
