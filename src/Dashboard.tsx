import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { BillsTab } from './components/dashboard/BillsTab'
import { DashboardHeader } from './components/dashboard/DashboardHeader'
import { EmailVerificationBanner } from './components/dashboard/EmailVerificationBanner'
import { HistoryTab } from './components/dashboard/HistoryTab'
import { InvoiceTab } from './components/dashboard/InvoiceTab'
import { MonthTab } from './components/dashboard/MonthTab'
import { ViewTabs, type View } from './components/dashboard/ViewTabs'
import { SkeletonCards, SkeletonPanel } from './components/Skeleton'
import { useAuth } from './contexts/AuthContext'
import { useUi } from './contexts/UiContext'
import { useBudget } from './hooks/useBudget'
import { useCategorization } from './hooks/useCategorization'
import { useFinance } from './hooks/useFinance'
import { useInvoiceHistory } from './hooks/useInvoiceHistory'
import { useInvoices } from './hooks/useInvoices'
import { useRules } from './hooks/useRules'
import { useTransactionFilters } from './hooks/useTransactionFilters'
import { loadBudget } from './services/budgetService'
import { clearLegacyLocalRules, readLegacyLocalRules } from './services/categoryEngine'
import {
  importLegacyRules,
  listCategoryRules,
  rulesToMap,
} from './services/categoryRulesService'
import { listBillPayments, listBills, listExpenses, listIncomes } from './services/financeService'
import { listInvoices, loadInvoice } from './services/firestoreService'
import { listMySpaces } from './services/spacesService'
import type { ActiveScope, Space } from './types/Space'
import { scopeRoot } from './firebase/paths'
import { addMonths, formatDueDate } from './utils/invoiceReference'
import { computeForecast, currentMonth } from './utils/monthPlan'
import { getErrorMessage } from './utils/errors'
import packageJson from '../package.json'

/**
 * Lê o escopo ativo salvo no localStorage por uid.
 * Devolve `{ kind: 'personal' }` se não houver nada salvo ou o espaço não
 * existir mais na lista de espaços disponíveis.
 */
function readSavedScope(uid: string, available: Space[]): ActiveScope {
  try {
    const raw = localStorage.getItem(`activeScope:${uid}`)
    if (!raw) return { kind: 'personal' }
    const parsed = JSON.parse(raw) as { kind: string; spaceId?: string }
    if (parsed.kind === 'space' && parsed.spaceId) {
      const space = available.find((s) => s.id === parsed.spaceId)
      if (space) return { kind: 'space', space }
    }
  } catch {
    // ignore
  }
  return { kind: 'personal' }
}

function writeSavedScope(uid: string, scope: ActiveScope): void {
  try {
    if (scope.kind === 'personal') {
      localStorage.removeItem(`activeScope:${uid}`)
    } else {
      localStorage.setItem(
        `activeScope:${uid}`,
        JSON.stringify({ kind: 'space', spaceId: scope.space.id }),
      )
    }
  } catch {
    // ignore
  }
}

/**
 * Painel principal (área logada).
 * Carregado sob demanda pelo App.tsx depois do login, junto com o Firestore.
 */
export default function Dashboard() {
  const { user, logout, refreshUser } = useAuth()
  const { toast, confirm, theme, toggleTheme } = useUi()

  const [cloudLoading, setCloudLoading] = useState(true)
  const [view, setView] = useState<View>('month')
  const [month, setMonth] = useState(currentMonth())

  // ----- Espaços -----
  const [spaces, setSpaces] = useState<Space[]>([])
  const [activeScope, setActiveScopeState] = useState<ActiveScope>({ kind: 'personal' })

  /** Raiz Firestore do escopo ativo. */
  const root = user ? scopeRoot(user.uid, activeScope) : ''

  const setActiveScope = useCallback(
    (scope: ActiveScope) => {
      if (!user) return
      setActiveScopeState(scope)
      writeSavedScope(user.uid, scope)
    },
    [user],
  )

  const handleSpaceRenamed = useCallback(
    (updated: Space) => {
      setSpaces((current) =>
        current.map((s) => (s.id === updated.id ? updated : s)),
      )
      setActiveScopeState((current) => {
        if (current.kind === 'space' && current.space.id === updated.id) {
          const next: ActiveScope = { kind: 'space', space: updated }
          if (user) writeSavedScope(user.uid, next)
          return next
        }
        return current
      })
    },
    [user],
  )

  const notifyError = (cause: unknown) => toast(getErrorMessage(cause), 'error')

  const {
    bills,
    payments,
    incomes,
    expenses,
    savingFinance,
    handleSaveBill,
    handleDeleteBill,
    handlePayBill,
    handleUnpayBill,
    handleSaveIncome,
    handleDeleteIncome,
    handleSaveExpense,
    handleDeleteExpense,
    setBills,
    setPayments,
    setIncomes,
    setExpenses,
  } = useFinance({ root, month, toast, confirm })

  const { rules, savingRule, setSavingRule, ruleMap, setRules, saveRule, deleteRule } = useRules({
    root,
    toast,
    confirm,
  })

  // A carga de uma fatura precisa limpar os filtros da tabela. O ref permite
  // passar o reset para o hook sem inverter a ordem dos hooks.
  const resetFiltersRef = useRef<() => void>(() => {})

  const {
    invoices,
    setInvoices,
    selectedInvoiceId,
    setSelectedInvoiceId,
    fileName,
    setFileName,
    transactions,
    setTransactions,
    loading,
    invoiceLoading,
    deleting,
    error,
    applyLoadedInvoice,
    handleFile,
    handleInvoiceSelection,
    handleDeleteInvoice,
  } = useInvoices({
    root,
    toast,
    confirm,
    resetFilters: () => resetFiltersRef.current(),
  })

  const { allInvoices, setAllInvoices } = useInvoiceHistory({
    user,
    root,
    invoices,
    transactions,
    view,
    cloudLoading,
    onError: notifyError,
  })

  const {
    search,
    categoryFilter,
    typeFilter,
    categories,
    filtered,
    resetFilters,
    setSearch,
    setCategoryFilter,
    setTypeFilter,
  } = useTransactionFilters(transactions)

  useEffect(() => {
    resetFiltersRef.current = resetFilters
  }, [resetFilters])

  const { applyCategoryToMerchant, handleCategoryChange, handleRuleChange, handleReapplyRules } =
    useCategorization({
      root,
      toast,
      transactions,
      setTransactions,
      selectedInvoiceId,
      ruleMap,
      setRules,
      setSavingRule,
      saveRule,
    })

  const { budget, savingBudget, saveBudget: handleSaveBudget, setBudget } = useBudget({ root })

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

  // ----- Lista de espaços do usuário -----
  useEffect(() => {
    if (!user) return

    let cancelled = false

    listMySpaces(user.uid)
      .then((mySpaces) => {
        if (cancelled) return
        setSpaces(mySpaces)
        const savedScope = readSavedScope(user.uid, mySpaces)
        setActiveScopeState(savedScope)
      })
      .catch((cause) => {
        if (!cancelled) notifyError(cause)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // ----- Carga inicial e recarga de escopo: depende de [user, root] com flag cancelled -----
  useEffect(() => {
    if (!user || !root) return

    let cancelled = false

    const loadScopeData = async () => {
      setCloudLoading(true)

      // Limpa dados do escopo anterior imediatamente
      setRules([])
      setBudget({ monthlyLimit: 0, categories: {} })
      setBills([])
      setPayments([])
      setIncomes([])
      setExpenses([])
      setInvoices([])
      setSelectedInvoiceId('')
      setFileName('')
      setTransactions([])
      setAllInvoices(null)

      try {
        let foundRules = await listCategoryRules(root)

        // A migração de regras do localStorage só roda no Pessoal
        if (activeScope.kind === 'personal') {
          const legacyRules = readLegacyLocalRules()
          if (Object.keys(legacyRules).length > 0) {
            const imported = await importLegacyRules(root, legacyRules, rulesToMap(foundRules))
            clearLegacyLocalRules()
            if (imported > 0) foundRules = await listCategoryRules(root)
          }
        }

        const [foundBudget, foundBills, foundPayments, foundIncomes, foundExpenses, foundInvoices] =
          await Promise.all([
            loadBudget(root),
            listBills(root),
            listBillPayments(root),
            listIncomes(root),
            listExpenses(root),
            listInvoices(root),
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
          const latestInvoice = await loadInvoice(root, foundInvoices[0].id)
          if (cancelled) return
          applyLoadedInvoice(latestInvoice.id, latestInvoice.fileName, latestInvoice.transactions)
        }
      } catch (cause) {
        if (!cancelled) notifyError(cause)
      } finally {
        if (!cancelled) setCloudLoading(false)
      }
    }

    void loadScopeData()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, root])

  const openInvoice = (invoiceId: string) => {
    setView('invoice')
    void handleInvoiceSelection(invoiceId)
  }

  if (!user) return null

  const busy = savingRule || savingFinance || savingBudget || invoiceLoading

  return (
    <div className="app-shell">
      <DashboardHeader
        uid={user.uid}
        email={user.email}
        theme={theme}
        onToggleTheme={toggleTheme}
        onLogout={() => void logout()}
        view={view}
        month={month}
        invoiceMonth={invoiceMonth}
        selectedInvoice={selectedInvoice}
        dueDateLabel={dueDateLabel}
        fileName={fileName}
        invoiceCount={invoices.length}
        billCount={bills.length}
        incomeCount={incomes.length}
        spaces={spaces}
        activeScope={activeScope}
        onScopeChange={(scope) => {
          setActiveScope(scope)
        }}
        onSpacesChange={setSpaces}
        onSpaceRenamed={handleSpaceRenamed}
        toast={toast}
      />

      <main className="container-app">
        <ViewTabs view={view} onChange={setView} />

        {!user.emailVerified &&
          user.providerData.some((provider) => provider.providerId === 'password') && (
            <EmailVerificationBanner email={user.email} onRefresh={refreshUser} toast={toast} />
          )}

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
          <MonthTab
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
            onSaveExpense={handleSaveExpense}
            onDeleteExpense={(expense) => void handleDeleteExpense(expense)}
          />
        )}

        {/* ---------- Contas e receitas ---------- */}
        {!cloudLoading && view === 'bills' && (
          <BillsTab
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
          <HistoryTab data={financeData} allInvoices={allInvoices} />
        )}

        {/* ---------- Cartão ---------- */}
        {!cloudLoading && view === 'invoice' && (
          <InvoiceTab
            invoices={invoices}
            selectedInvoiceId={selectedInvoiceId}
            invoiceMonth={invoiceMonth}
            fileName={fileName}
            transactions={transactions}
            loading={loading}
            error={error}
            invoiceLoading={invoiceLoading}
            deleting={deleting}
            rules={rules}
            budget={budget}
            savingBudget={savingBudget}
            savingRule={savingRule}
            filtered={filtered}
            categories={categories}
            search={search}
            categoryFilter={categoryFilter}
            typeFilter={typeFilter}
            onInvoiceSelection={(invoiceId) => void handleInvoiceSelection(invoiceId)}
            onDeleteInvoice={() => void handleDeleteInvoice()}
            onFile={(file) => void handleFile(file, ruleMap)}
            onSaveBudget={(next) => void handleSaveBudget(next)}
            onAssignCategory={(title, category) => void applyCategoryToMerchant(title, category)}
            onSearch={setSearch}
            onCategoryFilter={setCategoryFilter}
            onTypeFilter={setTypeFilter}
            onCategoryChange={handleCategoryChange}
            onRuleChange={handleRuleChange}
            onDeleteRule={(rule) => void deleteRule(rule)}
            onReapplyRules={() => void handleReapplyRules()}
          />
        )}
      </main>

      <footer>Minha Fatura · dados sincronizados pelo Firebase · v{packageJson.version}</footer>
    </div>
  )
}
