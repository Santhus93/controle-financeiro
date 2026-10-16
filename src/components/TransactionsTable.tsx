import { Search } from 'lucide-react'
import type { Transaction, TransactionCategory } from '../types/Transaction'
import { TRANSACTION_CATEGORIES } from '../types/Transaction'
import { formatCurrency } from '../utils/currency'
import { formatDate } from '../utils/dates'
import { TYPE_LABELS } from '../services/transactionClassifier'

interface TransactionsTableProps {
  transactions: Transaction[]
  categories: string[]
  search: string
  categoryFilter: string
  typeFilter: string
  onSearch: (value: string) => void
  onCategoryFilter: (value: string) => void
  onTypeFilter: (value: string) => void
  onCategoryChange: (id: string, category: TransactionCategory) => void
}

export function TransactionsTable(props: TransactionsTableProps) {
  const total = props.transactions.reduce((sum, item) => sum + item.amount, 0)

  return (
    <section className="panel table-panel">
      <div className="panel-heading table-heading">
        <div>
          <span className="eyebrow">Detalhamento</span>
          <h2>Lançamentos</h2>
        </div>
        <span className="result-count">
          {props.transactions.length} registro(s) · {formatCurrency(total)}
        </span>
      </div>

      <div className="filters">
        <label className="search-field">
          <Search size={17} />
          <input
            value={props.search}
            onChange={(event) => props.onSearch(event.target.value)}
            placeholder="Pesquisar estabelecimento..."
          />
        </label>
        <select value={props.categoryFilter} onChange={(event) => props.onCategoryFilter(event.target.value)}>
          <option value="all">Todas as categorias</option>
          {props.categories.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
        <select value={props.typeFilter} onChange={(event) => props.onTypeFilter(event.target.value)}>
          <option value="all">Todos os tipos</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className="table-scroll">
        <table className="transactions-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Tipo</th>
              <th>Categoria</th>
              <th className="money">Valor</th>
            </tr>
          </thead>
          <tbody>
            {props.transactions.map((item) => (
              <tr key={item.id}>
                <td className="cell-date">{formatDate(item.date)}</td>
                <td className="cell-title">
                  <strong className="merchant">{item.title}</strong>
                  {item.installment && (
                    <small className="row-note">
                      Parcela {item.installment.current}/{item.installment.total}
                    </small>
                  )}
                </td>
                <td className="cell-type">
                  <span className={`type-badge ${item.type}`}>{TYPE_LABELS[item.type]}</span>
                </td>
                <td className="cell-category">
                  <select
                    className="category-select"
                    value={item.category}
                    onChange={(event) =>
                      props.onCategoryChange(item.id, event.target.value as TransactionCategory)
                    }
                  >
                    {TRANSACTION_CATEGORIES.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                </td>
                <td className={`money cell-amount ${item.amount < 0 ? 'credit' : ''}`}>
                  {formatCurrency(item.amount)}
                </td>
              </tr>
            ))}
            {!props.transactions.length && (
              <tr>
                <td colSpan={5} className="empty-table">
                  Nenhum lançamento encontrado com os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
