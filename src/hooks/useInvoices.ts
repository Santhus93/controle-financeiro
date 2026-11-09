import { useState } from 'react'
import type { ConfirmOptions, ToastType } from '../contexts/UiContext'
import { detectCategory, type CategoryRuleMap } from '../services/categoryEngine'
import { describeLedgerCheck, importStatement } from '../services/importService'
import {
  deleteInvoice,
  findEquivalentInvoice,
  listInvoices,
  loadInvoice,
  saveInvoice,
} from '../services/firestoreService'
import type { InvoiceSummary } from '../types/Invoice'
import type { Transaction } from '../types/Transaction'
import { formatMonthLabel } from '../utils/invoiceReference'
import { getErrorMessage } from '../utils/errors'

interface UseInvoicesParams {
  root: string
  toast: (message: string, type?: ToastType) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
  resetFilters: () => void
}

function formatReferenceMonth(referenceMonth: string): string {
  return formatMonthLabel(referenceMonth)
}

/**
 * Faturas do cartão: lista, fatura aberta e lançamentos.
 * `resetFilters` é chamado sempre que uma fatura é carregada, para a tabela
 * voltar a mostrar todos os lançamentos.
 */
export function useInvoices({ root, toast, confirm, resetFilters }: UseInvoicesParams) {
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([])
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('')
  const [fileName, setFileName] = useState('')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const notifyError = (cause: unknown) => toast(getErrorMessage(cause), 'error')

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

  const handleFile = async (file: File, ruleMap: CategoryRuleMap) => {
    if (!root) return

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
      const equivalent = await findEquivalentInvoice(root, file.name, categorized)
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
          const existing = await loadInvoice(root, equivalent.invoice.id)
          applyLoadedInvoice(existing.id, existing.fileName, existing.transactions)
          toast(`Importação cancelada: a fatura de ${label} foi mantida.`, 'info')
          return
        }

        await deleteInvoice(root, equivalent.invoice.id)
        replacedLabel = ` Substituiu ${equivalent.invoice.fileName}.`
      }

      const result = await saveInvoice(root, file.name, categorized, statement.card)
      const refreshedInvoices = await listInvoices(root)

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
    if (!root || !invoiceId || invoiceId === selectedInvoiceId) return

    setInvoiceLoading(true)

    try {
      const invoice = await loadInvoice(root, invoiceId)
      applyLoadedInvoice(invoice.id, invoice.fileName, invoice.transactions)
    } catch (cause) {
      notifyError(cause)
    } finally {
      setInvoiceLoading(false)
    }
  }

  const handleDeleteInvoice = async () => {
    if (!root || !selectedInvoiceId) return

    const selectedInvoice = invoices.find((invoice) => invoice.id === selectedInvoiceId)
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
      await deleteInvoice(root, selectedInvoiceId)
      const remainingInvoices = await listInvoices(root)
      setInvoices(remainingInvoices)

      if (remainingInvoices.length > 0) {
        const nextInvoice = await loadInvoice(root, remainingInvoices[0].id)
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

  return {
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
    setError,
    applyLoadedInvoice,
    handleFile,
    handleInvoiceSelection,
    handleDeleteInvoice,
  }
}
