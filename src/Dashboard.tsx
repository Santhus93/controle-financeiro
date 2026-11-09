import { useEffect, useMemo, useRef, useState } from 'react'
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
import { addMonths, formatDueDate } from './utils/invoiceReference'
import { computeForecast, currentMonth } from './utils/monthPlan'
import { getErrorMessage } from './utils/errors'
import packageJson from '../package.json'

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
  } = useFinance({ uid: user?.uid, month, toast, confirm })

  const { rules, savingRule, setSavingRule, ruleMap, setRules, saveRule, deleteRule } = useRules({
    uid: user?.uid,
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
    fileName,
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
    uid: user?.uid,
    toast,
    confirm,
    resetFilters: () => resetFiltersRef.current(),
  })

  const { allInvoices } = useInvoiceHistory({
    user,
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
      uid: user?.uid,
      toast,
      transactions,
      setTransactions,
      selectedInvoiceId,
      ruleMap,
      setRules,
      setSavingRule,
      saveRule,
    })

  const { budget, savingBudget, saveBudget: handleSaveBudget, setBudget } = useBudget()

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

  const openInvoice = (invoiceId: string) => {
    setView('invoice')
    void handleInvoiceSelection(invoiceId)
  }

  if (!user) return null

  const busy = savingRule || savingFinance || savingBudget || invoiceLoading

  return (
    <div className="app-shell">
      <DashboardHeader
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
