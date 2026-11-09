import { useCallback, useMemo, useState } from 'react'
import type { Transaction } from '../types/Transaction'

/**
 * Filtros da tabela de lançamentos do cartão.
 * Recebe a fatura já carregada e devolve a lista filtrada junto com os controles.
 */
export function useTransactionFilters(transactions: Transaction[]) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  const categories = useMemo(
    () => [...new Set(transactions.map((item) => item.category))].sort(),
    [transactions],
  )

  const filtered = useMemo(
    () =>
      transactions.filter((item) => {
        const matchesSearch = item.originalTitle
          .toLowerCase()
          .includes(search.trim().toLowerCase())
        const matchesCategory =
          categoryFilter === 'all' || item.category === categoryFilter
        const matchesType = typeFilter === 'all' || item.type === typeFilter
        return matchesSearch && matchesCategory && matchesType
      }),
    [transactions, search, categoryFilter, typeFilter],
  )

  const resetFilters = useCallback(() => {
    setSearch('')
    setCategoryFilter('all')
    setTypeFilter('all')
  }, [])

  return {
    search,
    categoryFilter,
    typeFilter,
    categories,
    filtered,
    resetFilters,
    setSearch,
    setCategoryFilter,
    setTypeFilter,
  }
}
