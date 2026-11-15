import { Coins, Search } from 'lucide-react'
import type { Receivable, ReceivablePayment } from '../types/Receivable'
import type { Transaction, TransactionCategory } from '../types/Transaction'
import { TRANSACTION_CATEGORIES } from '../types/Transaction'
import { formatCurrency } from '../utils/currency'
import { formatDate } from '../utils/dates'
import {
  RECEIVABLE_STATUS_LABELS,
  canCreateReceivableFromTransaction,
  findReceivableByTransaction,
  receivableBalance,
} from '../utils/receivables'
import { TYPE_LABELS } from '../services/transactionClassifier'

interface TransactionsTableProps {
  transactions: Transaction[]
  categories: string[]
  search: string
  categoryFilter: string
  typeFilter: string
  canEdit?: boolean
  invoiceId?: string
  receivables?: Receivable[]
  payments?: ReceivablePayment[]
  onSearch: (value: string) => void
  onCategoryFilter: (value: string) => void
  onTypeFilter: (value: string) => void
  onCategoryChange: (id: string, category: TransactionCategory) => void
  onCharge?: (transaction: Transaction) => void
  onViewReceivable?: (receivable: Receivable) => void
}

export function TransactionsTable(props: TransactionsTableProps) {
  const total = props.transactions.reduce((sum, item) => sum + item.amount, 0)
  const canEdit = props.canEdit ?? true
  const receivables = props.receivables ?? []
  const payments = props.payments ?? []
  const invoiceId = props.invoiceId ?? ''

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
            {props.transactions.map((item) => {
              const linked = invoiceId
                ? findReceivableByTransaction(receivables, invoiceId, item.id)
                : undefined
              const balance = linked ? receivableBalance(linked, payments) : null
              const eligible = canCreateReceivableFromTransaction(item)

              return (
                <tr key={item.id}>
                  <td className="cell-date">{formatDate(item.date)}</td>
                  <td className="cell-title">
                    <strong className="merchant">{item.title}</strong>
                    {item.installment && (
                      <small className="row-note">
                        Parcela {item.installment.current}/{item.installment.total}
                      </small>
                    )}
                    {linked && balance && (
                      <div className="transaction-receivable">
                        <span className={`receivable-badge ${balance.status}`}>
                          A cobrar · {RECEIVABLE_STATUS_LABELS[balance.status]}
                        </span>
                        {props.onViewReceivable && (
                          <button
                            type="button"
                            className="receivable-inline-action"
                            onClick={() => props.onViewReceivable?.(linked)}
                          >
                            Ver cobrança
                          </button>
                        )}
                      </div>
                    )}
                    {!linked && eligible && canEdit && props.onCharge && (
                      <button
                        type="button"
                        className="receivable-inline-action charge"
                        onClick={() => props.onCharge?.(item)}
                      >
                        <Coins size={12} /> A cobrar
                      </button>
                    )}
                  </td>
                  <td className="cell-type">
                    <span className={`type-badge ${item.type}`}>{TYPE_LABELS[item.type]}</span>
                  </td>
                  <td className="cell-category">
                    {canEdit ? (
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
                    ) : (
                      <span>{item.category}</span>
                    )}
                  </td>
                  <td className={`money cell-amount ${item.amount < 0 ? 'credit' : ''}`}>
                    {formatCurrency(item.amount)}
                  </td>
                </tr>
              )
            })}
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
