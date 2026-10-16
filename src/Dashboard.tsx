import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  Cloud,
  CreditCard,
  LoaderCircle,
  LogOut,
  Receipt,
  Trash2,
} from 'lucide-react'
import { BillsManager } from './components/BillsManager'
import { BudgetPanel } from './components/BudgetPanel'
import { CategoryChart } from './components/CategoryChart'
import { CategoryRules } from './components/CategoryRules'
import { FileUpload } from './components/FileUpload'
import { HistoryView } from './components/HistoryView'
import { Installments } from './components/Installments'
import { MonthOverview } from './components/MonthOverview'
import { SpendingChart } from './components/SpendingChart'
import { SummaryCards } from './components/SummaryCards'
import { TopMerchants } from './components/TopMerchants'
import { TransactionsTable } from './components/TransactionsTable'
import { UncategorizedPanel } from './components/UncategorizedPanel'
import { useAuth } from './contexts/AuthContext'
import { EMPTY_BUDGET, loadBudget, saveBudget, type Budget } from './services/budgetService'
import {
  clearLegacyLocalRules,
  detectCategory,
  merchantKey,
  readLegacyLocalRules,
} from './services/categoryEngine'
import {
  deleteCategoryRule,
  importLegacyRules,
  listCategoryRules,
  rulesToMap,
  saveCategoryRule,
  sortRules,
  type CategoryRule,
} from './services/categoryRulesService'
import {
  deleteBill,
  deleteIncome,
  listBillPayments,
  listBills,
  listIncomes,
  markBillPaid,
  saveBill,
  saveIncome,
  unmarkBillPaid,
} from './services/financeService'
import { describeLedgerCheck, importStatement } from './services/importService'
import {
  deleteInvoice,
  findEquivalentInvoice,
  listInvoices,
  loadAllInvoices,
  loadInvoice,
  saveInvoice,
  updateTransactionsCategory,
} from './services/firestoreService'
import type { Bill, BillPayment, Income, NewBill, NewIncome } from './types/Finance'
import type { InvoiceSummary, SavedInvoice } from './types/Invoice'
import type { Transaction, TransactionCategory } from './types/Transaction'
import { formatDueDate, formatMonthLabel } from './utils/invoiceReference'
import { currentMonth } from './utils/monthPlan'

type View = 'month' | 'invoice' | 'bills' | 'history'

function formatReferenceMonth(referenceMonth: string): string {
  return formatMonthLabel(referenceMonth)
}

function getFirestoreErrorMessage(cause: unknown): string {
  if (cause instanceof Error) return cause.message
  return 'Ocorreu uma falha ao acessar os dados na nuvem.'
}

/**
 * Painel principal (área logada).
 * Carregado sob demanda pelo App.tsx depois do login, junto com o Firestore e os gráficos.
 */
export default function Dashboard() {
  const { user, logout } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([])
  const [rules, setRules] = useState<CategoryRule[]>([])
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('')
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [cloudLoading, setCloudLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [savingRule, setSavingRule] = useState(false)
  const [error, setError] = useState('')
  const [cloudMessage, setCloudMessage] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [view, setView] = useState<View>('month')
  const [history, setHistory] = useState<SavedInvoice[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [budget, setBudget] = useState<Budget>(EMPTY_BUDGET)
  const [savingBudget, setSavingBudget] = useState(false)
  const [month, setMonth] = useState(currentMonth())
  const [bills, setBills] = useState<Bill[]>([])
  const [payments, setPayments] = useState<BillPayment[]>([])
  const [incomes, setIncomes] = useState<Income[]>([])
  const [savingFinance, setSavingFinance] = useState(false)

  const ruleMap = useMemo(() => rulesToMap(rules), [rules])
  const selectedInvoice = invoices.find((invoice) => invoice.id === selectedInvoiceId)
  const invoiceMonth = selectedInvoice?.referenceMonth ?? ''
  const dueDateLabel = formatDueDate(fileName)

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

  // Qualquer alteração em faturas ou categorias invalida o histórico carregado.
  useEffect(() => {
    setHistory(null)
  }, [invoices, transactions])

  useEffect(() => {
    if (!user || view !== 'history' || history !== null) return

    let cancelled = false
    setHistoryLoading(true)

    loadAllInvoices(user.uid)
      .then((data) => {
        if (!cancelled) setHistory(data)
      })
      .catch((cause) => {
        if (!cancelled) setError(getFirestoreErrorMessage(cause))
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user, view, history])

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
      setRules([])
      setBudget(EMPTY_BUDGET)
      setBills([])
      setPayments([])
      setIncomes([])
      setTransactions([])
      setSelectedInvoiceId('')
      setFileName('')
      return
    }

    let cancelled = false

    const loadInitialData = async () => {
      setCloudLoading(true)
      setError('')
      setCloudMessage('Carregando seus dados...')

      try {
        let foundRules = await listCategoryRules(user.uid)

        // Migra regras antigas da V1 (localStorage) para o Firestore, uma única vez.
        const legacyRules = readLegacyLocalRules()
        if (Object.keys(legacyRules).length > 0) {
          const imported = await importLegacyRules(user.uid, legacyRules, rulesToMap(foundRules))
          clearLegacyLocalRules()
          if (imported > 0) foundRules = await listCategoryRules(user.uid)
        }

        if (cancelled) return
        setRules(foundRules)

        const [foundBudget, foundBills, foundPayments, foundIncomes, foundInvoices] = await Promise.all([
          loadBudget(user.uid),
          listBills(user.uid),
          listBillPayments(user.uid),
          listIncomes(user.uid),
          listInvoices(user.uid),
        ])
        if (cancelled) return

        setBudget(foundBudget)
        setBills(foundBills)
        setPayments(foundPayments)
        setIncomes(foundIncomes)
        setInvoices(foundInvoices)

        if (foundInvoices.length > 0) {
          const latestInvoice = await loadInvoice(user.uid, foundInvoices[0].id)
          if (cancelled) return

          applyLoadedInvoice(
            latestInvoice.id,
            latestInvoice.fileName,
            latestInvoice.transactions,
          )
        }
        setCloudMessage('')
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
      const statement = await importStatement(file)

      // Aplica as regras do usuário (Firestore) antes de salvar.
      const categorized = statement.transactions.map((item) => ({
        ...item,
        category: detectCategory(item.originalTitle, ruleMap),
      }))

      // Verifica se a mesma fatura já existe, inclusive em outro formato (CSV x OFX).
      const equivalent = await findEquivalentInvoice(user.uid, file.name, categorized)
      let replacedLabel = ''

      if (equivalent && !equivalent.identical) {
        const label = `${formatReferenceMonth(equivalent.invoice.referenceMonth)} (${equivalent.invoice.fileName})`
        const replace = window.confirm(
          `A fatura de ${label} já está salva: ${equivalent.matched} de ${equivalent.total} lançamentos têm o mesmo valor.\n\n` +
            `OK: substituir pela versão ${statement.format.toUpperCase()} (${file.name}).\n` +
            'Cancelar: manter a fatura atual.',
        )

        if (!replace) {
          const existing = await loadInvoice(user.uid, equivalent.invoice.id)
          applyLoadedInvoice(existing.id, existing.fileName, existing.transactions)
          setCloudMessage(`Importação cancelada: a fatura de ${label} foi mantida.`)
          return
        }

        await deleteInvoice(user.uid, equivalent.invoice.id)
        replacedLabel = ` Substituiu ${equivalent.invoice.fileName}.`
      }

      const result = await saveInvoice(user.uid, file.name, categorized, statement.card)
      const refreshedInvoices = await listInvoices(user.uid)

      setInvoices(refreshedInvoices)
      applyLoadedInvoice(
        result.invoice.id,
        result.invoice.fileName,
        result.invoice.transactions,
      )
      setCloudMessage(
        (result.alreadyExisted
          ? 'Esta fatura já estava salva. A versão existente foi carregada.'
          : `Fatura ${statement.card} (${statement.format.toUpperCase()}) salva com ${categorized.length} lançamentos e as suas regras de categoria aplicadas.` +
            replacedLabel) +
          describeLedgerCheck(statement),
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

  /**
   * Salva a regra do estabelecimento no Firestore e atualiza
   * todos os lançamentos do mesmo estabelecimento na fatura aberta.
   */
  const applyCategoryToMerchant = async (title: string, category: TransactionCategory) => {
    if (!user) return

    const key = merchantKey(title)
    const affected = transactions.filter((item) => merchantKey(item.originalTitle) === key)

    setTransactions((current) =>
      current.map((item) =>
        merchantKey(item.originalTitle) === key ? { ...item, category } : item,
      ),
    )

    setSavingRule(true)
    setError('')

    try {
      const rule = await saveCategoryRule(user.uid, title, category)
      setRules((current) => sortRules([...current.filter((item) => item.id !== rule.id), rule]))

      if (selectedInvoiceId && affected.length) {
        await updateTransactionsCategory(
          user.uid,
          selectedInvoiceId,
          affected.map((item) => item.id),
          category,
        )
      }

      setCloudMessage(
        `Regra salva: ${affected.length} lançamento(s) de "${affected[0]?.title ?? title}" agora em ${category}.`,
      )
    } catch (cause) {
      setError(getFirestoreErrorMessage(cause))
    } finally {
      setSavingRule(false)
    }
  }

  const handleSaveBudget = async (next: Budget) => {
    if (!user) return

    setSavingBudget(true)
    setError('')

    try {
      const saved = await saveBudget(user.uid, next)
      setBudget(saved)
      setCloudMessage('Orçamento salvo na sua conta.')
    } catch (cause) {
      setError(getFirestoreErrorMessage(cause))
    } finally {
      setSavingBudget(false)
    }
  }

  // ---------- Contas fixas e receitas ----------

  /** Executa uma operação de contas/receitas com indicador de salvamento e tratamento de erro. */
  const runFinance = async (operation: () => Promise<void>, message: string): Promise<boolean> => {
    if (!user) return false

    setSavingFinance(true)
    setError('')

    try {
      await operation()
      setCloudMessage(message)
      return true
    } catch (cause) {
      setError(getFirestoreErrorMessage(cause))
      return false
    } finally {
      setSavingFinance(false)
    }
  }

  const handleSaveBill = (bill: NewBill) =>
    runFinance(async () => {
      const saved = await saveBill(user!.uid, bill)
      setBills((current) => [...current.filter((item) => item.id !== saved.id), saved])
    }, `Conta "${bill.name.trim()}" salva.`)

  const handleDeleteBill = (bill: Bill) => {
    if (!window.confirm(`Excluir a conta "${bill.name}" e o histórico de pagamentos dela?`)) return
    void runFinance(async () => {
      await deleteBill(user!.uid, bill.id)
      setBills((current) => current.filter((item) => item.id !== bill.id))
      setPayments((current) => current.filter((item) => item.billId !== bill.id))
    }, `Conta "${bill.name}" excluída.`)
  }

  const handlePayBill = (bill: Bill, amount: number) =>
    void runFinance(async () => {
      const payment = await markBillPaid(user!.uid, bill.id, month, amount)
      setPayments((current) => [...current.filter((item) => item.id !== payment.id), payment])
    }, `"${bill.name}" marcada como paga.`)

  const handleUnpayBill = (bill: Bill) =>
    void runFinance(async () => {
      await unmarkBillPaid(user!.uid, bill.id, month)
      setPayments((current) => current.filter((item) => !(item.billId === bill.id && item.month === month)))
    }, `Pagamento de "${bill.name}" desfeito.`)

  const handleSaveIncome = (income: NewIncome) =>
    runFinance(async () => {
      const saved = await saveIncome(user!.uid, income)
      setIncomes((current) => [...current.filter((item) => item.id !== saved.id), saved])
    }, `Receita "${income.name.trim()}" salva.`)

  const handleDeleteIncome = (income: Income) => {
    if (!window.confirm(`Excluir a receita "${income.name}"?`)) return
    void runFinance(async () => {
      await deleteIncome(user!.uid, income.id)
      setIncomes((current) => current.filter((item) => item.id !== income.id))
    }, `Receita "${income.name}" excluída.`)
  }

  const openInvoice = (invoiceId: string) => {
    setView('invoice')
    void handleInvoiceSelection(invoiceId)
  }

  const handleCategoryChange = (id: string, category: TransactionCategory) => {
    const transaction = transactions.find((item) => item.id === id)
    if (transaction) void applyCategoryToMerchant(transaction.originalTitle, category)
  }

  const handleRuleChange = (rule: CategoryRule, category: TransactionCategory) => {
    void applyCategoryToMerchant(rule.sampleTitle, category)
  }

  const handleDeleteRule = async (rule: CategoryRule) => {
    if (!user) return
    if (!window.confirm(`Excluir a regra "${rule.sampleTitle}" → ${rule.category}?`)) return

    setSavingRule(true)
    setError('')

    try {
      await deleteCategoryRule(user.uid, rule.id)
      setRules((current) => current.filter((item) => item.id !== rule.id))
      setCloudMessage('Regra excluída. Os lançamentos já categorizados foram mantidos.')
    } catch (cause) {
      setError(getFirestoreErrorMessage(cause))
    } finally {
      setSavingRule(false)
    }
  }

  const handleReapplyRules = async () => {
    if (!user || !selectedInvoiceId) return

    const changes = transactions
      .map((item) => ({ item, ruleCategory: ruleMap[merchantKey(item.originalTitle)] }))
      .filter(({ item, ruleCategory }) => ruleCategory && ruleCategory !== item.category)

    if (!changes.length) {
      setCloudMessage('Nenhuma alteração: a fatura já está de acordo com as regras.')
      return
    }

    setSavingRule(true)
    setError('')

    try {
      const byCategory = new Map<TransactionCategory, string[]>()
      changes.forEach(({ item, ruleCategory }) => {
        const ids = byCategory.get(ruleCategory) ?? []
        ids.push(item.id)
        byCategory.set(ruleCategory, ids)
      })

      for (const [category, ids] of byCategory) {
        await updateTransactionsCategory(user.uid, selectedInvoiceId, ids, category)
      }

      setTransactions((current) =>
        current.map((item) => {
          const ruleCategory = ruleMap[merchantKey(item.originalTitle)]
          return ruleCategory ? { ...item, category: ruleCategory } : item
        }),
      )
      setCloudMessage(`${changes.length} lançamento(s) atualizado(s) pelas regras.`)
    } catch (cause) {
      setError(getFirestoreErrorMessage(cause))
    } finally {
      setSavingRule(false)
    }
  }

  if (!user) return null

  const busy = cloudLoading || savingRule || savingFinance

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
            <h1>Seu mês inteiro, em um só lugar.</h1>
            <p>
              Receitas, fatura do cartão e contas fixas juntas, para você saber quanto
              entra, quanto sai e quanto sobra.
            </p>
          </div>

          <div className="reference-box">
            <span>{view === 'invoice' ? 'Fatura analisada' : 'Mês em foco'}</span>
            <strong>
              {view === 'invoice'
                ? invoiceMonth
                  ? formatReferenceMonth(invoiceMonth)
                  : 'Nenhuma fatura'
                : formatReferenceMonth(month)}
            </strong>
            <small>
              {view === 'invoice'
                ? `${selectedInvoice?.card ? `${selectedInvoice.card} · ` : ''}${
                    dueDateLabel ? `Vencimento ${dueDateLabel} · ` : ''
                  }${fileName || 'Importe um arquivo para começar'}`
                : `${invoices.length} fatura(s) · ${bills.length} conta(s) fixa(s) · ${incomes.length} receita(s)`}
            </small>
          </div>
        </div>
      </header>

      <main className="container-app">
        <nav className="view-tabs four">
          <button type="button" className={view === 'month' ? 'active' : ''} onClick={() => setView('month')}>
            <CalendarDays size={16} /> <span>Meu mês</span>
          </button>
          <button type="button" className={view === 'invoice' ? 'active' : ''} onClick={() => setView('invoice')}>
            <CreditCard size={16} /> <span>Cartão</span>
          </button>
          <button type="button" className={view === 'bills' ? 'active' : ''} onClick={() => setView('bills')}>
            <Receipt size={16} /> <span>Contas</span>
          </button>
          <button type="button" className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}>
            <BarChart3 size={16} /> <span>Histórico</span>
          </button>
        </nav>

        {(cloudMessage || busy) && (
          <div className="cloud-message">
            {busy && <LoaderCircle className="spin" size={16} />}
            <span>
              {savingRule ? 'Salvando regra de categoria...' : savingFinance ? 'Salvando...' : cloudMessage}
            </span>
          </div>
        )}

        {error && view !== 'invoice' && <div className="inline-error history-error">{error}</div>}

        {/* ---------- Meu mês ---------- */}
        {view === 'month' && !cloudLoading && (
          <MonthOverview
            month={month}
            onMonthChange={setMonth}
            invoices={invoices}
            bills={bills}
            payments={payments}
            incomes={incomes}
            saving={savingFinance}
            onPay={handlePayBill}
            onUnpay={handleUnpayBill}
            onOpenInvoice={openInvoice}
            onManage={() => setView('bills')}
          />
        )}

        {/* ---------- Contas e receitas ---------- */}
        {view === 'bills' && (
          <BillsManager
            month={month}
            bills={bills}
            incomes={incomes}
            saving={savingFinance}
            onSaveBill={handleSaveBill}
            onDeleteBill={handleDeleteBill}
            onSaveIncome={handleSaveIncome}
            onDeleteIncome={handleDeleteIncome}
          />
        )}

        {/* ---------- Histórico ---------- */}
        {view === 'history' && !(error && history === null) && (
          historyLoading || history === null ? (
            <div className="cloud-message">
              <LoaderCircle className="spin" size={16} />
              <span>Carregando o histórico das faturas...</span>
            </div>
          ) : (
            <HistoryView invoices={history} />
          )
        )}

        {/* ---------- Cartão ---------- */}
        {view === 'invoice' && (
          <>
            <section className="cloud-toolbar">
              <div className="cloud-toolbar-title">
                <Cloud size={19} />
                <div>
                  <strong>Faturas do cartão</strong>
                  <span>
                    {invoices.length} fatura(s) · {rules.length} regra(s) de categoria
                  </span>
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
                        {formatReferenceMonth(invoice.referenceMonth)} · {invoice.card} · {invoice.fileName}
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

            <FileUpload
              fileName={fileName}
              loading={loading}
              error={error}
              onFile={handleFile}
            />
          </>
        )}

        {view === 'invoice' && transactions.length > 0 && (
          <>
            <SummaryCards transactions={transactions} />
            <BudgetPanel
              transactions={transactions}
              budget={budget}
              saving={savingBudget}
              onSave={(next) => void handleSaveBudget(next)}
            />
            <UncategorizedPanel
              transactions={transactions}
              saving={savingRule}
              onAssign={(title, category) => void applyCategoryToMerchant(title, category)}
            />
            <section className="charts-grid">
              <CategoryChart transactions={transactions} />
              <SpendingChart transactions={transactions} />
            </section>
            <TopMerchants transactions={transactions} />
            {invoiceMonth && <Installments transactions={transactions} invoiceMonth={invoiceMonth} />}
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
            <CategoryRules
              rules={rules}
              transactions={transactions}
              saving={savingRule}
              onChange={handleRuleChange}
              onDelete={(rule) => void handleDeleteRule(rule)}
              onReapply={() => void handleReapplyRules()}
            />
          </>
        )}

        {view === 'invoice' && !transactions.length && !loading && !cloudLoading && (
          <section className="welcome-state">
            <div className="welcome-number">01</div>
            <div>
              <span className="eyebrow">Primeira importação</span>
              <h2>Importe a fatura do seu cartão</h2>
              <p>
                Use o arquivo OFX exportado pelo seu banco (funciona com qualquer banco)
                ou o CSV do Nubank. A fatura e os lançamentos são salvos na sua área
                protegida e a mais recente é carregada automaticamente.
              </p>
            </div>
          </section>
        )}
      </main>

      <footer>Minha Fatura · dados sincronizados pelo Firebase</footer>
    </div>
  )
}
