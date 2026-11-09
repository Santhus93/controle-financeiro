import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  Cloud,
  CreditCard,
  LoaderCircle,
  LogOut,
  Moon,
  Receipt,
  Sun,
  Trash2,
} from 'lucide-react'
import { BillsManager } from './components/BillsManager'
import { BudgetPanel } from './components/BudgetPanel'
import { CategoryRules } from './components/CategoryRules'
import { ExpensesPanel } from './components/ExpensesPanel'
import { FileUpload } from './components/FileUpload'
import { Installments } from './components/Installments'
import { MonthOverview } from './components/MonthOverview'
import { SkeletonCards, SkeletonPanel } from './components/Skeleton'
import { SummaryCards } from './components/SummaryCards'
import { TopMerchants } from './components/TopMerchants'
import { TransactionsTable } from './components/TransactionsTable'
import { UncategorizedPanel } from './components/UncategorizedPanel'
import { useAuth } from './contexts/AuthContext'
import { useUi } from './contexts/UiContext'
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
  deleteExpense,
  deleteIncome,
  listBillPayments,
  listBills,
  listExpenses,
  listIncomes,
  markBillPaid,
  saveBill,
  saveExpense,
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
import type {
  Bill,
  BillPayment,
  Expense,
  Income,
  NewBill,
  NewExpense,
  NewIncome,
} from './types/Finance'
import type { InvoiceSummary, SavedInvoice } from './types/Invoice'
import type { Transaction, TransactionCategory } from './types/Transaction'
import { addMonths, formatDueDate, formatMonthLabel } from './utils/invoiceReference'
import { computeForecast, currentMonth } from './utils/monthPlan'
import { getErrorMessage } from './utils/errors'
import packageJson from '../package.json'

// Componentes com gráficos (Recharts) só são baixados quando aparecem na tela.
const CategoryChart = lazy(() =>
  import('./components/CategoryChart').then((module) => ({ default: module.CategoryChart })),
)
const SpendingChart = lazy(() =>
  import('./components/SpendingChart').then((module) => ({ default: module.SpendingChart })),
)
const HistoryView = lazy(() =>
  import('./components/HistoryView').then((module) => ({ default: module.HistoryView })),
)
const CashflowHistory = lazy(() =>
  import('./components/CashflowHistory').then((module) => ({ default: module.CashflowHistory })),
)

type View = 'month' | 'invoice' | 'bills' | 'history'

function formatReferenceMonth(referenceMonth: string): string {
  return formatMonthLabel(referenceMonth)
}

/**
 * Painel principal (área logada).
 * Carregado sob demanda pelo App.tsx depois do login, junto com o Firestore.
 */
export default function Dashboard() {
  const { user, logout } = useAuth()
  const { toast, confirm, theme, toggleTheme } = useUi()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([])
  const [rules, setRules] = useState<CategoryRule[]>([])
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('')
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [cloudLoading, setCloudLoading] = useState(true)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [savingRule, setSavingRule] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [view, setView] = useState<View>('month')
  const [allInvoices, setAllInvoices] = useState<SavedInvoice[] | null>(null)
  const [budget, setBudget] = useState<Budget>(EMPTY_BUDGET)
  const [savingBudget, setSavingBudget] = useState(false)
  const [month, setMonth] = useState(currentMonth())
  const [bills, setBills] = useState<Bill[]>([])
  const [payments, setPayments] = useState<BillPayment[]>([])
  const [incomes, setIncomes] = useState<Income[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [savingFinance, setSavingFinance] = useState(false)

  const ruleMap = useMemo(() => rulesToMap(rules), [rules])
  const selectedInvoice = invoices.find((invoice) => invoice.id === selectedInvoiceId)
  const invoiceMonth = selectedInvoice?.referenceMonth ?? ''
  const dueDateLabel = formatDueDate(fileName)

  const financeData = useMemo(
    () => ({ invoices, bills, payments, incomes, expenses }),
    [invoices, bills, payments, incomes, expenses],
  )

  const forecast = useMemo(
    () => (allInvoices ? computeForecast(addMonths(month, 1), financeData, allInvoices) : null),
    [allInvoices, financeData, month],
  )

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

  const notifyError = (cause: unknown) => toast(getErrorMessage(cause), 'error')

  // Faturas completas (com lançamentos): usadas na previsão e no histórico.
  // Qualquer alteração em faturas ou categorias invalida a cópia carregada.
  useEffect(() => {
    setAllInvoices(null)
  }, [invoices, transactions])

  useEffect(() => {
    if (!user || cloudLoading || allInvoices !== null) return
    if (view !== 'month' && view !== 'history') return

    let cancelled = false

    loadAllInvoices(user.uid)
      .then((data) => {
        if (!cancelled) setAllInvoices(data)
      })
      .catch((cause) => {
        if (!cancelled) notifyError(cause)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, view, allInvoices, cloudLoading])

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
    if (!user) return

    let cancelled = false

    const loadInitialData = async () => {
      setCloudLoading(true)

      try {
        let foundRules = await listCategoryRules(user.uid)

        // Migra regras antigas da V1 (localStorage) para o Firestore, uma única vez.
        const legacyRules = readLegacyLocalRules()
        if (Object.keys(legacyRules).length > 0) {
          const imported = await importLegacyRules(user.uid, legacyRules, rulesToMap(foundRules))
          clearLegacyLocalRules()
          if (imported > 0) foundRules = await listCategoryRules(user.uid)
        }

        const [foundBudget, foundBills, foundPayments, foundIncomes, foundExpenses, foundInvoices] =
          await Promise.all([
            loadBudget(user.uid),
            listBills(user.uid),
            listBillPayments(user.uid),
            listIncomes(user.uid),
            listExpenses(user.uid),
            listInvoices(user.uid),
          ])
        if (cancelled) return

        setRules(foundRules)
        setBudget(foundBudget)
        setBills(foundBills)
        setPayments(foundPayments)
        setIncomes(foundIncomes)
        setExpenses(foundExpenses)
        setInvoices(foundInvoices)

        if (foundInvoices.length > 0) {
          const latestInvoice = await loadInvoice(user.uid, foundInvoices[0].id)
          if (cancelled) return
          applyLoadedInvoice(latestInvoice.id, latestInvoice.fileName, latestInvoice.transactions)
        }
      } catch (cause) {
        if (!cancelled) notifyError(cause)
      } finally {
        if (!cancelled) setCloudLoading(false)
      }
    }

    void loadInitialData()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // ---------- Cartão ----------

  const handleFile = async (file: File) => {
    if (!user) return

    setLoading(true)
    setError('')

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
        const replace = await confirm({
          title: 'Esta fatura já está salva',
          message:
            `A fatura de ${label} já existe: ${equivalent.matched} de ${equivalent.total} lançamentos têm o mesmo valor.\n\n` +
            `Deseja substituí-la pela versão ${statement.format.toUpperCase()} (${file.name})?`,
          confirmLabel: 'Substituir',
          cancelLabel: 'Manter a atual',
        })

        if (!replace) {
          const existing = await loadInvoice(user.uid, equivalent.invoice.id)
          applyLoadedInvoice(existing.id, existing.fileName, existing.transactions)
          toast(`Importação cancelada: a fatura de ${label} foi mantida.`, 'info')
          return
        }

        await deleteInvoice(user.uid, equivalent.invoice.id)
        replacedLabel = ` Substituiu ${equivalent.invoice.fileName}.`
      }

      const result = await saveInvoice(user.uid, file.name, categorized, statement.card)
      const refreshedInvoices = await listInvoices(user.uid)

      setInvoices(refreshedInvoices)
      applyLoadedInvoice(result.invoice.id, result.invoice.fileName, result.invoice.transactions)
      toast(
        (result.alreadyExisted
          ? 'Esta fatura já estava salva. A versão existente foi carregada.'
          : `Fatura ${statement.card} (${statement.format.toUpperCase()}) salva com ${categorized.length} lançamentos.` +
            replacedLabel) + describeLedgerCheck(statement),
        result.alreadyExisted ? 'info' : 'success',
      )
    } catch (cause) {
      setError(getErrorMessage(cause))
    } finally {
      setLoading(false)
    }
  }

  const handleInvoiceSelection = async (invoiceId: string) => {
    if (!user || !invoiceId || invoiceId === selectedInvoiceId) return

    setInvoiceLoading(true)

    try {
      const invoice = await loadInvoice(user.uid, invoiceId)
      applyLoadedInvoice(invoice.id, invoice.fileName, invoice.transactions)
    } catch (cause) {
      notifyError(cause)
    } finally {
      setInvoiceLoading(false)
    }
  }

  const handleDeleteInvoice = async () => {
    if (!user || !selectedInvoiceId) return

    const label = selectedInvoice ? formatReferenceMonth(selectedInvoice.referenceMonth) : 'esta fatura'
    const ok = await confirm({
      title: 'Excluir fatura',
      message: `A fatura de ${label} e todos os lançamentos dela serão apagados. As regras de categoria são mantidas.`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return

    setDeleting(true)

    try {
      await deleteInvoice(user.uid, selectedInvoiceId)
      const remainingInvoices = await listInvoices(user.uid)
      setInvoices(remainingInvoices)

      if (remainingInvoices.length > 0) {
        const nextInvoice = await loadInvoice(user.uid, remainingInvoices[0].id)
        applyLoadedInvoice(nextInvoice.id, nextInvoice.fileName, nextInvoice.transactions)
      } else {
        setSelectedInvoiceId('')
        setFileName('')
        setTransactions([])
        resetFilters()
      }
      toast(`Fatura de ${label} excluída.`)
    } catch (cause) {
      notifyError(cause)
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
      current.map((item) => (merchantKey(item.originalTitle) === key ? { ...item, category } : item)),
    )

    setSavingRule(true)

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

      toast(`${affected.length} lançamento(s) de "${affected[0]?.title ?? title}" agora em ${category}.`)
    } catch (cause) {
      notifyError(cause)
    } finally {
      setSavingRule(false)
    }
  }

  const handleSaveBudget = async (next: Budget) => {
    if (!user) return

    setSavingBudget(true)

    try {
      const saved = await saveBudget(user.uid, next)
      setBudget(saved)
      toast('Orçamento salvo.')
    } catch (cause) {
      notifyError(cause)
    } finally {
      setSavingBudget(false)
    }
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

    const ok = await confirm({
      title: 'Excluir regra',
      message: `A regra "${rule.sampleTitle}" → ${rule.category} será excluída. Os lançamentos já categorizados não mudam.`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return

    setSavingRule(true)

    try {
      await deleteCategoryRule(user.uid, rule.id)
      setRules((current) => current.filter((item) => item.id !== rule.id))
      toast('Regra excluída.')
    } catch (cause) {
      notifyError(cause)
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
      toast('A fatura já está de acordo com as regras.', 'info')
      return
    }

    setSavingRule(true)

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
      toast(`${changes.length} lançamento(s) atualizado(s) pelas regras.`)
    } catch (cause) {
      notifyError(cause)
    } finally {
      setSavingRule(false)
    }
  }

  // ---------- Contas fixas, receitas e gastos avulsos ----------

  /** Executa uma operação financeira com indicador de salvamento, aviso e tratamento de erro. */
  const runFinance = async (operation: () => Promise<void>, message: string): Promise<boolean> => {
    if (!user) return false

    setSavingFinance(true)

    try {
      await operation()
      toast(message)
      return true
    } catch (cause) {
      notifyError(cause)
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

  const handleDeleteBill = async (bill: Bill) => {
    const ok = await confirm({
      title: 'Excluir conta fixa',
      message: `A conta "${bill.name}" e todo o histórico de pagamentos dela serão apagados.`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return

    await runFinance(async () => {
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

  const handleDeleteIncome = async (income: Income) => {
    const ok = await confirm({
      title: 'Excluir receita',
      message: `A receita "${income.name}" será apagada de todos os meses.`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return

    await runFinance(async () => {
      await deleteIncome(user!.uid, income.id)
      setIncomes((current) => current.filter((item) => item.id !== income.id))
    }, `Receita "${income.name}" excluída.`)
  }

  const handleSaveExpense = (expense: NewExpense) =>
    runFinance(async () => {
      const saved = await saveExpense(user!.uid, expense)
      setExpenses((current) => [...current.filter((item) => item.id !== saved.id), saved])
    }, `Gasto "${expense.description.trim()}" salvo.`)

  const handleDeleteExpense = async (expense: Expense) => {
    const ok = await confirm({
      title: 'Excluir gasto',
      message: `O gasto "${expense.description}" será apagado.`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return

    await runFinance(async () => {
      await deleteExpense(user!.uid, expense.id)
      setExpenses((current) => current.filter((item) => item.id !== expense.id))
    }, `Gasto "${expense.description}" excluído.`)
  }

  const openInvoice = (invoiceId: string) => {
    setView('invoice')
    void handleInvoiceSelection(invoiceId)
  }

  if (!user) return null

  const busy = savingRule || savingFinance || savingBudget || invoiceLoading

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-inner">
          <div>
            <div className="hero-topline">
              <span className="brand-pill">CONTROLE FINANCEIRO</span>
              <div className="user-session">
                <span>{user.email}</span>
                <button
                  type="button"
                  className="theme-toggle"
                  onClick={toggleTheme}
                  aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
                  title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
                >
                  {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                </button>
                <button type="button" onClick={() => void logout()}>
                  <LogOut size={15} /> Sair
                </button>
              </div>
            </div>
            <h1>Seu mês inteiro, em um só lugar.</h1>
            <p>
              Receitas, fatura do cartão, contas fixas e gastos avulsos juntos, para você saber
              quanto entra, quanto sai e quanto sobra.
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
        <nav className="view-tabs four" aria-label="Navegação principal">
          <button type="button" className={view === 'month' ? 'active' : ''} onClick={() => setView('month')}>
            <CalendarDays size={18} /> <span>Meu mês</span>
          </button>
          <button type="button" className={view === 'invoice' ? 'active' : ''} onClick={() => setView('invoice')}>
            <CreditCard size={18} /> <span>Cartão</span>
          </button>
          <button type="button" className={view === 'bills' ? 'active' : ''} onClick={() => setView('bills')}>
            <Receipt size={18} /> <span>Contas</span>
          </button>
          <button type="button" className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}>
            <BarChart3 size={18} /> <span>Histórico</span>
          </button>
        </nav>

        {busy && (
          <div className="saving-indicator" aria-live="polite">
            <LoaderCircle className="spin" size={14} /> Salvando...
          </div>
        )}

        {/* ---------- Carregamento inicial ---------- */}
        {cloudLoading && (
          <>
            <SkeletonCards count={4} />
            <SkeletonPanel lines={4} />
            <SkeletonPanel lines={3} />
          </>
        )}

        {/* ---------- Meu mês ---------- */}
        {!cloudLoading && view === 'month' && (
          <MonthOverview
            month={month}
            onMonthChange={setMonth}
            invoices={invoices}
            bills={bills}
            payments={payments}
            incomes={incomes}
            expenses={expenses}
            forecast={forecast}
            saving={savingFinance}
            onPay={handlePayBill}
            onUnpay={handleUnpayBill}
            onOpenInvoice={openInvoice}
            onManage={() => setView('bills')}
          >
            <ExpensesPanel
              month={month}
              expenses={expenses}
              saving={savingFinance}
              onSave={handleSaveExpense}
              onDelete={(expense) => void handleDeleteExpense(expense)}
            />
          </MonthOverview>
        )}

        {/* ---------- Contas e receitas ---------- */}
        {!cloudLoading && view === 'bills' && (
          <BillsManager
            month={month}
            bills={bills}
            incomes={incomes}
            saving={savingFinance}
            onSaveBill={handleSaveBill}
            onDeleteBill={(bill) => void handleDeleteBill(bill)}
            onSaveIncome={handleSaveIncome}
            onDeleteIncome={(income) => void handleDeleteIncome(income)}
          />
        )}

        {/* ---------- Histórico ---------- */}
        {!cloudLoading && view === 'history' && (
          <Suspense
            fallback={
              <>
                <SkeletonCards count={4} />
                <SkeletonPanel chart />
              </>
            }
          >
            <CashflowHistory data={financeData} />
            {allInvoices === null ? (
              <>
                <SkeletonCards count={4} />
                <SkeletonPanel chart />
              </>
            ) : (
              <HistoryView invoices={allInvoices} />
            )}
          </Suspense>
        )}

        {/* ---------- Cartão ---------- */}
        {!cloudLoading && view === 'invoice' && (
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
                    disabled={invoiceLoading || invoices.length === 0}
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
                  disabled={!selectedInvoiceId || deleting || invoiceLoading}
                  onClick={() => void handleDeleteInvoice()}
                >
                  {deleting ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />}
                  Excluir
                </button>
              </div>
            </section>

            <FileUpload fileName={fileName} loading={loading} error={error} onFile={handleFile} />

            {invoiceLoading && (
              <>
                <SkeletonCards count={5} />
                <SkeletonPanel lines={4} />
              </>
            )}

            {!invoiceLoading && transactions.length > 0 && (
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
                <Suspense
                  fallback={
                    <section className="charts-grid">
                      <SkeletonPanel chart />
                      <SkeletonPanel chart />
                    </section>
                  }
                >
                  <section className="charts-grid">
                    <CategoryChart transactions={transactions} />
                    <SpendingChart transactions={transactions} />
                  </section>
                </Suspense>
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

            {!invoiceLoading && !transactions.length && !loading && (
              <section className="welcome-state">
                <div className="welcome-number">01</div>
                <div>
                  <span className="eyebrow">Primeira importação</span>
                  <h2>Importe a fatura do seu cartão</h2>
                  <p>
                    Use o arquivo OFX exportado pelo seu banco (funciona com qualquer banco) ou o
                    CSV do Nubank. A fatura e os lançamentos são salvos na sua área protegida.
                  </p>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <footer>Minha Fatura · dados sincronizados pelo Firebase · v{packageJson.version}</footer>
    </div>
  )
}
