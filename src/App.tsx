import { useMemo, useState } from 'react'
import { LogOut } from 'lucide-react'
import { CategoryChart } from './components/CategoryChart'
import { FileUpload } from './components/FileUpload'
import { Installments } from './components/Installments'
import { Login } from './components/Login'
import { SpendingChart } from './components/SpendingChart'
import { SummaryCards } from './components/SummaryCards'
import { TransactionsTable } from './components/TransactionsTable'
import { useAuth } from './contexts/AuthContext'
import { parseNubankCsv } from './services/csvParser'
import { saveCustomCategory } from './services/categoryEngine'
import type { Transaction, TransactionCategory } from './types/Transaction'
import { formatMonthReference } from './utils/dates'
import './App.css'

function App() {
  const { user, loading: authLoading, logout } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
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

  const handleFile = async (file: File) => {
    setLoading(true)
    setError('')

    try {
      const parsed = await parseNubankCsv(file)
      setTransactions(parsed)
      setFileName(file.name)
      setSearch('')
      setCategoryFilter('all')
      setTypeFilter('all')
    } catch (cause) {
      setTransactions([])
      setFileName('')
      setError(
        cause instanceof Error
          ? cause.message
          : 'Falha inesperada ao ler o arquivo.',
      )
    } finally {
      setLoading(false)
    }
  }

  const handleCategoryChange = (
    id: string,
    category: TransactionCategory,
  ) => {
    setTransactions((current) =>
      current.map((item) => {
        if (item.id !== id) return item
        saveCustomCategory(item.originalTitle, category)
        return { ...item, category }
      }),
    )
  }

  if (authLoading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-spinner" />
        <strong>Verificando acesso...</strong>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-inner">
          <div>
            <div className="hero-topline">
              <span className="brand-pill">CONTROLE FINANCEIRO</span>
              <div className="user-session">
                <span>{user.email}</span>
                <button type="button" onClick={() => void logout()}>
                  <LogOut size={15} /> Sair
                </button>
              </div>
            </div>
            <h1>Entenda para onde vai o dinheiro da sua fatura.</h1>
            <p>
              Importe o CSV do Nubank, revise as categorias e acompanhe despesas,
              estornos e parcelamentos sem enviar o arquivo para servidores.
            </p>
          </div>
          <div className="reference-box">
            <span>Referência analisada</span>
            <strong>
              {transactions.length
                ? formatMonthReference(transactions)
                : 'Nenhuma fatura'}
            </strong>
            <small>{fileName || 'Importe um arquivo para começar'}</small>
          </div>
        </div>
      </header>

      <main className="container-app">
        <FileUpload
          fileName={fileName}
          loading={loading}
          error={error}
          onFile={handleFile}
        />

        {transactions.length > 0 && (
          <>
            <SummaryCards transactions={transactions} />
            <section className="charts-grid">
              <CategoryChart transactions={transactions} />
              <SpendingChart transactions={transactions} />
            </section>
            <Installments transactions={transactions} />
            <TransactionsTable
              transactions={filtered}
              categories={categories}
              search={search}
              categoryFilter={categoryFilter}
              typeFilter={typeFilter}
              onSearch={setSearch}
              onCategoryFilter={setCategoryFilter}
              onTypeFilter={setTypeFilter}
              onCategoryChange={handleCategoryChange}
            />
          </>
        )}

        {!transactions.length && !loading && (
          <section className="welcome-state">
            <div className="welcome-number">01</div>
            <div>
              <span className="eyebrow">Primeiro passo</span>
              <h2>Use o CSV exportado pelo Nubank</h2>
              <p>
                A V1 reconhece as colunas <code>date</code>, <code>title</code> e{' '}
                <code>amount</code>. Pagamentos e estornos são separados dos gastos
                e descrições como “Parcela 2/5” alimentam a área de parcelamentos.
              </p>
            </div>
          </section>
        )}
      </main>

      <footer>Minha Fatura · sessão protegida pelo Firebase Authentication</footer>
    </div>
  )
}

export default App
