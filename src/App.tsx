import { useEffect, useMemo, useState } from 'react'
import { Cloud, LoaderCircle, LogOut, Trash2 } from 'lucide-react'
import { CategoryChart } from './components/CategoryChart'
import { FileUpload } from './components/FileUpload'
import { Installments } from './components/Installments'
import { Login } from './components/Login'
import { SpendingChart } from './components/SpendingChart'
import { SummaryCards } from './components/SummaryCards'
import { TransactionsTable } from './components/TransactionsTable'
import { useAuth } from './contexts/AuthContext'
import { saveCustomCategory } from './services/categoryEngine'
import { parseNubankCsv } from './services/csvParser'
import {
  deleteInvoice,
  listInvoices,
  loadInvoice,
  saveInvoice,
  updateTransactionCategory,
} from './services/firestoreService'
import type { InvoiceSummary } from './types/Invoice'
import type { Transaction, TransactionCategory } from './types/Transaction'
import { formatMonthReference } from './utils/dates'
import './App.css'

function formatReferenceMonth(referenceMonth: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(referenceMonth)
  if (!match) return referenceMonth

  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1)
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function getFirestoreErrorMessage(cause: unknown): string {
  if (cause instanceof Error) return cause.message
  return 'Ocorreu uma falha ao acessar os dados na nuvem.'
}

function App() {
  const { user, loading: authLoading, logout } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([])
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('')
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [cloudLoading, setCloudLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [cloudMessage, setCloudMessage] = useState('')
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

  const resetFilters = () => {
    setSearch('')
    setCategoryFilter('all')
    setTypeFilter('all')
  }

  const applyLoadedInvoice = (
    invoiceId: string,
    loadedFileName: string,
    loadedTransactions: Transaction[],
  ) => {
    setSelectedInvoiceId(invoiceId)
    setFileName(loadedFileName)
    setTransactions(loadedTransactions)
    resetFilters()
  }

  useEffect(() => {
    if (!user) {
      setInvoices([])
      setTransactions([])
      setSelectedInvoiceId('')
      setFileName('')
      return
    }

    let cancelled = false

    const loadInitialData = async () => {
      setCloudLoading(true)
      setError('')
      setCloudMessage('Carregando suas faturas...')

      try {
        const foundInvoices = await listInvoices(user.uid)
        if (cancelled) return

        setInvoices(foundInvoices)

        if (foundInvoices.length > 0) {
          const latestInvoice = await loadInvoice(user.uid, foundInvoices[0].id)
          if (cancelled) return

          applyLoadedInvoice(
            latestInvoice.id,
            latestInvoice.fileName,
            latestInvoice.transactions,
          )
          setCloudMessage('Fatura mais recente carregada da nuvem.')
        } else {
          setCloudMessage('Nenhuma fatura salva. Importe o primeiro CSV.')
        }
      } catch (cause) {
        if (!cancelled) {
          setError(getFirestoreErrorMessage(cause))
          setCloudMessage('')
        }
      } finally {
        if (!cancelled) setCloudLoading(false)
      }
    }

    void loadInitialData()

    return () => {
      cancelled = true
    }
  }, [user])

  const handleFile = async (file: File) => {
    if (!user) return

    setLoading(true)
    setError('')
    setCloudMessage('Lendo e salvando a fatura...')

    try {
      const parsed = await parseNubankCsv(file)
      const result = await saveInvoice(user.uid, file.name, parsed)
      const refreshedInvoices = await listInvoices(user.uid)

      setInvoices(refreshedInvoices)
      applyLoadedInvoice(
        result.invoice.id,
        result.invoice.fileName,
        result.invoice.transactions,
      )
      setCloudMessage(
        result.alreadyExisted
          ? 'Esta fatura já estava salva. A versão existente foi carregada.'
          : 'Fatura e lançamentos salvos no Firestore.',
      )
    } catch (cause) {
      setError(getFirestoreErrorMessage(cause))
      setCloudMessage('')
    } finally {
      setLoading(false)
    }
  }

  const handleInvoiceSelection = async (invoiceId: string) => {
    if (!user || !invoiceId || invoiceId === selectedInvoiceId) return

    setCloudLoading(true)
    setError('')
    setCloudMessage('Carregando a fatura selecionada...')

    try {
      const invoice = await loadInvoice(user.uid, invoiceId)
      applyLoadedInvoice(invoice.id, invoice.fileName, invoice.transactions)
      setCloudMessage('Fatura carregada da nuvem.')
    } catch (cause) {
      setError(getFirestoreErrorMessage(cause))
      setCloudMessage('')
    } finally {
      setCloudLoading(false)
    }
  }

  const handleDeleteInvoice = async () => {
    if (!user || !selectedInvoiceId) return

    const selectedInvoice = invoices.find((invoice) => invoice.id === selectedInvoiceId)
    const label = selectedInvoice
      ? formatReferenceMonth(selectedInvoice.referenceMonth)
      : 'esta fatura'

    if (!window.confirm(`Excluir ${label} e todos os seus lançamentos salvos?`)) return

    setDeleting(true)
    setError('')
    setCloudMessage('Excluindo a fatura...')

    try {
      await deleteInvoice(user.uid, selectedInvoiceId)
      const remainingInvoices = await listInvoices(user.uid)
      setInvoices(remainingInvoices)

      if (remainingInvoices.length > 0) {
        const nextInvoice = await loadInvoice(user.uid, remainingInvoices[0].id)
        applyLoadedInvoice(nextInvoice.id, nextInvoice.fileName, nextInvoice.transactions)
        setCloudMessage('Fatura excluída. A fatura mais recente foi carregada.')
      } else {
        setSelectedInvoiceId('')
        setFileName('')
        setTransactions([])
        resetFilters()
        setCloudMessage('Fatura excluída. Não há outras faturas salvas.')
      }
    } catch (cause) {
      setError(getFirestoreErrorMessage(cause))
      setCloudMessage('')
    } finally {
      setDeleting(false)
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

    if (user && selectedInvoiceId) {
      void updateTransactionCategory(user.uid, selectedInvoiceId, id, category).catch(
        (cause) => setError(getFirestoreErrorMessage(cause)),
      )
    }
  }

  if (authLoading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-spinner" />
        <strong>Verificando acesso...</strong>
      </div>
    )
  }

  if (!user) return <Login />

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
              Importe o CSV do Nubank, salve o histórico na nuvem e acompanhe
              despesas, estornos e parcelamentos em qualquer dispositivo.
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
        <section className="cloud-toolbar">
          <div className="cloud-toolbar-title">
            <Cloud size={19} />
            <div>
              <strong>Histórico na nuvem</strong>
              <span>{invoices.length} fatura(s) salva(s)</span>
            </div>
          </div>

          <div className="cloud-toolbar-actions">
            <label>
              <span>Fatura</span>
              <select
                value={selectedInvoiceId}
                disabled={cloudLoading || invoices.length === 0}
                onChange={(event) => void handleInvoiceSelection(event.target.value)}
              >
                {invoices.length === 0 && <option value="">Nenhuma fatura salva</option>}
                {invoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {formatReferenceMonth(invoice.referenceMonth)} · {invoice.fileName}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="delete-invoice-button"
              disabled={!selectedInvoiceId || deleting || cloudLoading}
              onClick={() => void handleDeleteInvoice()}
            >
              {deleting ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />}
              Excluir
            </button>
          </div>
        </section>

        {(cloudMessage || cloudLoading) && (
          <div className="cloud-message">
            {cloudLoading && <LoaderCircle className="spin" size={16} />}
            <span>{cloudMessage}</span>
          </div>
        )}

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

        {!transactions.length && !loading && !cloudLoading && (
          <section className="welcome-state">
            <div className="welcome-number">01</div>
            <div>
              <span className="eyebrow">Primeira importação</span>
              <h2>Importe o CSV exportado pelo Nubank</h2>
              <p>
                Após a leitura, a fatura e os lançamentos serão salvos na sua área
                protegida do Firestore. Nas próximas visitas, a fatura mais recente
                será carregada automaticamente.
              </p>
            </div>
          </section>
        )}
      </main>

      <footer>Minha Fatura · dados sincronizados pelo Firebase</footer>
    </div>
  )
}

export default App
