import { useCallback, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useUi } from '../contexts/UiContext'
import { EMPTY_BUDGET, saveBudget as persistBudget, type Budget } from '../services/budgetService'
import { getErrorMessage } from '../utils/errors'

interface UseBudgetParams {
  root: string
}

/**
 * Estado do orçamento por categoria.
 * O carregamento inicial continua no efeito do Dashboard; o hook cuida da
 * gravação no Firestore e do indicador de salvamento.
 */
export function useBudget({ root }: UseBudgetParams) {
  const { user } = useAuth()
  const { toast } = useUi()
  const [budget, setBudget] = useState<Budget>(EMPTY_BUDGET)
  const [savingBudget, setSavingBudget] = useState(false)

  const saveBudget = useCallback(
    async (next: Budget) => {
      if (!user || !root) return

      setSavingBudget(true)

      try {
        const saved = await persistBudget(root, next)
        setBudget(saved)
        toast('Orçamento salvo.')
      } catch (cause) {
        toast(getErrorMessage(cause), 'error')
      } finally {
        setSavingBudget(false)
      }
    },
    [root, user, toast],
  )

  return { budget, savingBudget, saveBudget, setBudget }
}
