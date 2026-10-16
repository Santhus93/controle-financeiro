import { useState } from 'react'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  PiggyBank,
  Receipt,
  Undo2,
} from 'lucide-react'
import type { Bill, BillPayment, Income } from '../types/Finance'
import type { InvoiceSummary } from '../types/Invoice'
import { formatCurrency } from '../utils/currency'
import { addMonths, formatDueDate, formatMonthLabel } from '../utils/invoiceReference'
import {
  billsForMonth,
  billStatus,
  dueDateIn,
  formatDayMonth,
  incomesForMonth,
  parseMoneyInput,
  paymentsByBill,
  toMoneyInput,
  type BillStatus,
} from '../utils/monthPlan'

interface MonthOverviewProps {
  month: string
  onMonthChange: (month: string) => void
  invoices: InvoiceSummary[]
  bills: Bill[]
  payments: BillPayment[]
  incomes: Income[]
  saving: boolean
  onPay: (bill: Bill, amount: number) => void
  onUnpay: (bill: Bill) => void
  onOpenInvoice: (invoiceId: string) => void
  onManage: () => void
}

const STATUS_LABEL: Record<BillStatus, string> = {
  paid: 'Paga',
  overdue: 'Atrasada',
  soon: 'Vence em breve',
  pending: 'A vencer',
}

export function MonthOverview({
  month,
  onMonthChange,
  invoices,
  bills,
  payments,
  incomes,
  saving,
  onPay,
  onUnpay,
  onOpenInvoice,
  onManage,
}: MonthOverviewProps) {
  const [payingId, setPayingId] = useState('')
  const [payValue, setPayValue] = useState('')

  const monthBills = billsForMonth(bills, month)
  const paid = paymentsByBill(payments, month)
  const monthIncomes = incomesForMonth(incomes, month)
  const monthInvoices = invoices.filter((invoice) => invoice.referenceMonth === month)

  const incomeTotal = monthIncomes.reduce((sum, income) => sum + income.amount, 0)
  const cardTotal = monthInvoices.reduce(
    (sum, invoice) => sum + invoice.totalExpenses - invoice.totalRefunds,
    0,
  )
  const billsPlanned = monthBills.reduce((sum, bill) => sum + (paid.get(bill.id)?.amount ?? bill.amount), 0)
  const billsPaidCount = monthBills.filter((bill) => paid.has(bill.id)).length
  const billsPaidTotal = monthBills.reduce((sum, bill) => sum + (paid.get(bill.id)?.amount ?? 0), 0)
  const expensesTotal = cardTotal + billsPlanned
  const leftover = incomeTotal - expensesTotal
  const committed = incomeTotal ? (expensesTotal / incomeTotal) * 100 : null

  const startPaying = (bill: Bill) => {
    if (!bill.variable) {
      onPay(bill, bill.amount)
      return
    }
    setPayingId(bill.id)
    setPayValue(toMoneyInput(bill.amount))
  }

  const confirmPaying = (bill: Bill) => {
    const value = parseMoneyInput(payValue)
    if (!value) return
    onPay(bill, value)
    setPayingId('')
  }

  const nothingConfigured = !bills.length && !incomes.length

  return (
    <div className="month-view">
      <section className="month-nav panel">
        <button type="button" aria-label="Mês anterior" onClick={() => onMonthChange(addMonths(month, -1))}>
          <ChevronLeft size={20} />
        </button>
        <div>
          <span className="eyebrow">Meu mês</span>
          <strong>{formatMonthLabel(month)}</strong>
        </div>
        <button type="button" aria-label="Próximo mês" onClick={() => onMonthChange(addMonths(month, 1))}>
          <ChevronRight size={20} />
        </button>
      </section>

      {nothingConfigured && (
        <section className="panel month-welcome">
          <PiggyBank size={28} />
          <div>
            <strong>Monte o seu mês completo</strong>
            <span>
              Cadastre o salário e as contas que não passam pelo cartão (aluguel, luz, água,
              internet...). O app soma tudo com a fatura e mostra quanto sobra.
            </span>
          </div>
          <button type="button" className="button-primary" onClick={onManage}>
            Cadastrar contas e receitas
          </button>
        </section>
      )}

      <section className="summary-grid month-kpis">
        <article className="stat-card green">
          <div className="stat-top"><span>Receitas</span><ArrowUpCircle size={18} /></div>
          <strong>{formatCurrency(incomeTotal)}</strong>
          <small>{monthIncomes.length} entrada(s)</small>
        </article>
        <article className="stat-card purple">
          <div className="stat-top"><span>Cartão</span><CreditCard size={18} /></div>
          <strong>{formatCurrency(cardTotal)}</strong>
          <small>{monthInvoices.length ? 'Fatura que vence no mês' : 'Nenhuma fatura neste mês'}</small>
        </article>
        <article className="stat-card orange">
          <div className="stat-top"><span>Contas fixas</span><Receipt size={18} /></div>
          <strong>{formatCurrency(billsPlanned)}</strong>
          <small>{billsPaidCount} de {monthBills.length} paga(s) · {formatCurrency(billsPaidTotal)}</small>
        </article>
        <article className={`stat-card ${leftover >= 0 ? 'blue' : 'danger'}`}>
          <div className="stat-top"><span>Sobra prevista</span><PiggyBank size={18} /></div>
          <strong>{formatCurrency(leftover)}</strong>
          <small>Receitas − cartão − contas</small>
        </article>
      </section>

      {committed !== null && (
        <section className="panel month-commitment">
          <div className="budget-row-head">
            <strong>Renda comprometida</strong>
            <span>
              {committed.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%{' '}
              <small>de {formatCurrency(incomeTotal)}</small>
            </span>
          </div>
          <div className={`budget-row ${committed > 100 ? 'over' : committed >= 80 ? 'warning' : 'ok'}`}>
            <div className="budget-bar"><span style={{ width: `${Math.min(committed, 100)}%` }} /></div>
          </div>
          <div className="commitment-split">
            <span><i className="dot card" /> Cartão {formatCurrency(cardTotal)}</span>
            <span><i className="dot bills" /> Contas {formatCurrency(billsPlanned)}</span>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Saídas do mês</span>
            <h2>Vencimentos</h2>
          </div>
          <button type="button" className="rules-reapply" onClick={onManage}>
            Gerenciar contas
          </button>
        </div>

        <div className="due-list">
          {monthInvoices.map((invoice) => {
            const due = formatDueDate(invoice.fileName)
            return (
              <div className="due-row invoice" key={invoice.id}>
                <div className="due-icon"><CreditCard size={17} /></div>
                <div className="due-info">
                  <strong>Fatura {invoice.card}</strong>
                  <span>{due ? `Vence ${due.slice(0, 5)}` : 'Cartão de crédito'} · {invoice.fileName}</span>
                </div>
                <div className="due-amount">{formatCurrency(invoice.totalExpenses - invoice.totalRefunds)}</div>
                <button type="button" className="due-action ghost" onClick={() => onOpenInvoice(invoice.id)}>
                  Ver fatura
                </button>
              </div>
            )
          })}

          {monthBills.map((bill) => {
            const payment = paid.get(bill.id)
            const status = billStatus(bill, month, payment)
            const due = formatDayMonth(dueDateIn(month, bill.dueDay))

            return (
              <div className={`due-row ${status}`} key={bill.id}>
                <div className="due-icon"><CalendarClock size={17} /></div>
                <div className="due-info">
                  <strong>{bill.name}</strong>
                  <span>
                    {bill.category} · vence {due}{' '}
                    <em className={`status-badge ${status}`}>{STATUS_LABEL[status]}</em>
                  </span>
                </div>
                <div className="due-amount">
                  {formatCurrency(payment?.amount ?? bill.amount)}
                  {bill.variable && !payment && <small>estimado</small>}
                </div>

                {payingId === bill.id ? (
                  <div className="due-pay-form">
                    <input
                      inputMode="decimal"
                      value={payValue}
                      autoFocus
                      onChange={(event) => setPayValue(event.target.value)}
                      aria-label="Valor pago"
                    />
                    <button type="button" className="due-action" disabled={saving} onClick={() => confirmPaying(bill)}>
                      <Check size={15} />
                    </button>
                  </div>
                ) : payment ? (
                  <button type="button" className="due-action ghost" disabled={saving} onClick={() => onUnpay(bill)}>
                    <Undo2 size={14} /> Desfazer
                  </button>
                ) : (
                  <button type="button" className="due-action" disabled={saving} onClick={() => startPaying(bill)}>
                    <Check size={14} /> Pagar
                  </button>
                )}
              </div>
            )
          })}

          {!monthInvoices.length && !monthBills.length && (
            <div className="empty-mini month-empty">Nenhum vencimento neste mês.</div>
          )}
        </div>
      </section>

      {monthIncomes.length > 0 && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Entradas do mês</span>
              <h2>Receitas</h2>
            </div>
          </div>
          <div className="due-list">
            {monthIncomes.map((income) => (
              <div className="due-row income" key={income.id}>
                <div className="due-icon"><ArrowDownCircle size={17} /></div>
                <div className="due-info">
                  <strong>{income.name}</strong>
                  <span>
                    Dia {formatDayMonth(dueDateIn(month, income.day))} ·{' '}
                    {income.recurring ? 'Todo mês' : 'Somente neste mês'}
                  </span>
                </div>
                <div className="due-amount positive">{formatCurrency(income.amount)}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
