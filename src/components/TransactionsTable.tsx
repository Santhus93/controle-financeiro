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
  return <section className="panel table-panel">
    <div className="panel-heading table-heading"><div><span className="eyebrow">Detalhamento</span><h2>Lançamentos</h2></div><span className="result-count">{props.transactions.length} registro(s)</span></div>
    <div className="filters"><label className="search-field"><Search size={17} /><input value={props.search} onChange={(e) => props.onSearch(e.target.value)} placeholder="Pesquisar estabelecimento..." /></label>
      <select value={props.categoryFilter} onChange={(e) => props.onCategoryFilter(e.target.value)}><option value="all">Todas as categorias</option>{props.categories.map((category) => <option key={category}>{category}</option>)}</select>
      <select value={props.typeFilter} onChange={(e) => props.onTypeFilter(e.target.value)}><option value="all">Todos os tipos</option>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    <div className="table-scroll"><table><thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Categoria</th><th className="money">Valor</th></tr></thead><tbody>
      {props.transactions.map((item) => <tr key={item.id}><td>{formatDate(item.date)}</td><td><strong className="merchant">{item.title}</strong>{item.installment && <small className="row-note">Parcela {item.installment.current}/{item.installment.total}</small>}</td><td><span className={`type-badge ${item.type}`}>{TYPE_LABELS[item.type]}</span></td><td><select className="category-select" value={item.category} onChange={(e) => props.onCategoryChange(item.id, e.target.value as TransactionCategory)}>{TRANSACTION_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></td><td className={`money ${item.amount < 0 ? 'credit' : ''}`}>{formatCurrency(item.amount)}</td></tr>)}
      {!props.transactions.length && <tr><td colSpan={5} className="empty-table">Nenhum lançamento encontrado com os filtros atuais.</td></tr>}
    </tbody></table></div>
  </section>
}
