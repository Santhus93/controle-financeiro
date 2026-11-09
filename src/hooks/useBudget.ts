import { useCallback, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useUi } from '../contexts/UiContext'
import { EMPTY_BUDGET, saveBudget as persistBudget, type Budget } from '../services/budgetService'
import { getErrorMessage } from '../utils/errors'

/**
 * Estado do orçamento por categoria.
 * O carregamento inicial continua no efeito do Dashboard; o hook cuida da
 * gravação no Firestore e do indicador de salvamento.
 */
export function useBudget() {
  const { user } = useAuth()
  const { toast } = useUi()
  const [budget, setBudget] = useState<Budget>(EMPTY_BUDGET)
  const [savingBudget, setSavingBudget] = useState(false)

  const saveBudget = useCallback(
    async (next: Budget) => {
      if (!user) return

      setSavingBudget(true)

      try {
        const saved = await persistBudget(user.uid, next)
        setBudget(saved)
        toast('Orçamento salvo.')
      } catch (cause) {
        toast(getErrorMessage(cause), 'error')
      } finally {
        setSavingBudget(false)
      }
    },
    [user, toast],
  )

  return { budget, savingBudget, saveBudget, setBudget }
}
