import { lazy, Suspense, useState } from 'react'
import { Cloud, LoaderCircle, Trash2 } from 'lucide-react'
import { BudgetPanel } from '../BudgetPanel'
import { CardReceivableForm } from '../CardReceivableForm'
import { CategoryRules } from '../CategoryRules'
import { FileUpload } from '../FileUpload'
import { Installments } from '../Installments'
import { SkeletonCards, SkeletonPanel } from '../Skeleton'
import { SummaryCards } from '../SummaryCards'
import { TopMerchants } from '../TopMerchants'
import { TransactionsTable } from '../TransactionsTable'
import { UncategorizedPanel } from '../UncategorizedPanel'
import type { Budget } from '../../services/budgetService'
import type { CategoryRule } from '../../services/categoryRulesService'
import type { CardReceivableInput } from '../../services/receivablesService'
import type { InvoiceSummary } from '../../types/Invoice'
import type { Receivable, ReceivablePayment } from '../../types/Receivable'
import type { Transaction, TransactionCategory } from '../../types/Transaction'
import { formatAuthorLabel } from '../../utils/authorship'
import { formatMonthLabel } from '../../utils/invoiceReference'

// Componentes com gráficos (Recharts) só são baixados quando aparecem na tela.
const CategoryChart = lazy(() =>
  import('../CategoryChart').then((module) => ({ default: module.CategoryChart })),
)
const SpendingChart = lazy(() =>
  import('../SpendingChart').then((module) => ({ default: module.SpendingChart })),
)

interface InvoiceTabProps {
  invoices: InvoiceSummary[]
  selectedInvoiceId: string
  invoiceMonth: string
  fileName: string
  transactions: Transaction[]
  loading: boolean
  error: string
  invoiceLoading: boolean
  deleting: boolean
  canEdit?: boolean
  isShared?: boolean
  rules: CategoryRule[]
  budget: Budget
  savingBudget: boolean
  savingRule: boolean
  filtered: Transaction[]
  categories: string[]
  search: string
  categoryFilter: string
  typeFilter: string
  receivables?: Receivable[]
  receivablePayments?: ReceivablePayment[]
  onInvoiceSelection: (invoiceId: string) => void
  onDeleteInvoice: () => void
  onFile: (file: File) => void
  onSaveBudget: (budget: Budget) => void
  onAssignCategory: (title: string, category: TransactionCategory) => void
  onSearch: (value: string) => void
  onCategoryFilter: (value: string) => void
  onTypeFilter: (value: string) => void
  onCategoryChange: (id: string, category: TransactionCategory) => void
  onRuleChange: (rule: CategoryRule, category: TransactionCategory) => void
  onDeleteRule: (rule: CategoryRule) => void
  onReapplyRules: () => void
  onCreateReceivableFromTransaction?: (
    invoiceId: string,
    transaction: Transaction,
    input: CardReceivableInput,
  ) => Promise<boolean>
  onViewReceivable?: (receivable: Receivable) => void
}

function formatReferenceMonth(referenceMonth: string): string {
  return formatMonthLabel(referenceMonth)
}

export function InvoiceTab({
  invoices,
  selectedInvoiceId,
  invoiceMonth,
  fileName,
  transactions,
  loading,
  error,
  invoiceLoading,
  deleting,
  canEdit = true,
  isShared = false,
  rules,
  budget,
  savingBudget,
  savingRule,
  filtered,
  categories,
  search,
  categoryFilter,
  typeFilter,
  receivables = [],
  receivablePayments = [],
  onInvoiceSelection,
  onDeleteInvoice,
  onFile,
  onSaveBudget,
  onAssignCategory,
  onSearch,
  onCategoryFilter,
  onTypeFilter,
  onCategoryChange,
  onRuleChange,
  onDeleteRule,
  onReapplyRules,
  onCreateReceivableFromTransaction,
  onViewReceivable,
}: InvoiceTabProps) {
  const selectedInvoice = invoices.find((invoice) => invoice.id === selectedInvoiceId)
  const importedBy = isShared ? formatAuthorLabel(selectedInvoice) : null
  const [charge, setCharge] = useState<{ invoiceId: string; transaction: Transaction } | null>(
    null,
  )

  const activeCharge = charge && charge.invoiceId === selectedInvoiceId ? charge : null

  const handleSaveCardReceivable = async (input: CardReceivableInput) => {
    if (!activeCharge || !onCreateReceivableFromTransaction) return false

    return onCreateReceivableFromTransaction(
      activeCharge.invoiceId,
      activeCharge.transaction,
      input,
    )
  }

  return (
    <>
      <section className="cloud-toolbar">
        <div className="cloud-toolbar-title">
          <Cloud size={19} />
          <div>
            <strong>Faturas do cartão</strong>
            <span>
              {invoices.length} fatura(s) · {rules.length} regra(s) de categoria
            </span>
            {importedBy && (
              <small className="authorship-label">Importada por {importedBy}</small>
            )}
          </div>
        </div>

        <div className="cloud-toolbar-actions">
          <label>
            <span>Fatura</span>
            <select
              value={selectedInvoiceId}
              disabled={invoiceLoading || invoices.length === 0}
              onChange={(event) => void onInvoiceSelection(event.target.value)}
            >
              {invoices.length === 0 && <option value="">Nenhuma fatura salva</option>}
              {invoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {formatReferenceMonth(invoice.referenceMonth)} · {invoice.card} · {invoice.fileName}
                </option>
              ))}
            </select>
          </label>

          {canEdit && (
            <button
              type="button"
              className="delete-invoice-button"
              disabled={!selectedInvoiceId || deleting || invoiceLoading}
              onClick={() => void onDeleteInvoice()}
            >
              {deleting ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />}
              Excluir
            </button>
          )}
        </div>
      </section>

      <FileUpload
        fileName={fileName}
        loading={loading}
        error={error}
        canEdit={canEdit}
        onFile={onFile}
      />

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
            canEdit={canEdit}
            onSave={onSaveBudget}
          />
          <UncategorizedPanel
            transactions={transactions}
            saving={savingRule}
            canEdit={canEdit}
            onAssign={onAssignCategory}
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
          {activeCharge && (
            <CardReceivableForm
              transaction={activeCharge.transaction}
              onCancel={() => setCharge(null)}
              onSave={handleSaveCardReceivable}
            />
          )}
          <TransactionsTable
            transactions={filtered}
            categories={categories}
            search={search}
            categoryFilter={categoryFilter}
            typeFilter={typeFilter}
            canEdit={canEdit}
            invoiceId={selectedInvoiceId}
            receivables={receivables}
            payments={receivablePayments}
            onSearch={onSearch}
            onCategoryFilter={onCategoryFilter}
            onTypeFilter={onTypeFilter}
            onCategoryChange={onCategoryChange}
            onCharge={
              canEdit && onCreateReceivableFromTransaction
                ? (transaction) => setCharge({ invoiceId: selectedInvoiceId, transaction })
                : undefined
            }
            onViewReceivable={onViewReceivable}
          />
          <CategoryRules
            rules={rules}
            transactions={transactions}
            saving={savingRule}
            canEdit={canEdit}
            onChange={onRuleChange}
            onDelete={onDeleteRule}
            onReapply={onReapplyRules}
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
  )
}
