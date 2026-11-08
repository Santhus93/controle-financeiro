import { useState, type ReactNode } from 'react'
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
  TrendingUp,
  Undo2,
  Wallet,
} from 'lucide-react'
import type { Bill, BillPayment, Expense, Income } from '../types/Finance'
import type { InvoiceSummary } from '../types/Invoice'
import { formatCurrency } from '../utils/currency'
import { addMonths, formatDueDate, formatMonthLabel } from '../utils/invoiceReference'
import {
  billsForMonth,
  billStatus,
  computeMonthSummary,
  dueDateIn,
  formatDayMonth,
  incomesForMonth,
  invoiceNet,
  parseMoneyInput,
  paymentsByBill,
  toMoneyInput,
  type BillStatus,
  type Forecast,
} from '../utils/monthPlan'

interface MonthOverviewProps {
  month: string
  onMonthChange: (month: string) => void
  invoices: InvoiceSummary[]
  bills: Bill[]
  payments: BillPayment[]
  incomes: Income[]
  expenses: Expense[]
  forecast: Forecast | null
  saving: boolean
  onPay: (bill: Bill, amount: number) => void
  onUnpay: (bill: Bill) => void
  onOpenInvoice: (invoiceId: string) => void
  onManage: () => void
  /** Conteúdo extra exibido depois dos vencimentos (gastos avulsos). */
  children?: ReactNode
}

const STATUS_LABEL: Record<BillStatus, string> = {
  paid: 'Paga',
  overdue: 'Atrasada',
  soon: 'Vence em breve',
  pending: 'A vencer',
}

function ForecastPanel({ forecast }: { forecast: Forecast | null }) {
  if (!forecast) {
    return (
      <section className="panel forecast-panel">
        <span className="skeleton-line short" />
        <span className="skeleton-line title" />
        <span className="skeleton-row" />
        <span className="skeleton-row" />
      </section>
    )
  }

  const positive = forecast.leftover >= 0

  return (
    <section className={`panel forecast-panel ${positive ? 'positive' : 'negative'}`}>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Previsão</span>
          <h2>{formatMonthLabel(forecast.month)}</h2>
        </div>
        <div className="forecast-result">
          <span>Sobra estimada</span>
          <strong>{formatCurrency(forecast.leftover)}</strong>
        </div>
      </div>

      <div className="forecast-lines">
        <div className="forecast-line">
          <span><ArrowUpCircle size={15} /> Receitas</span>
          <strong className="positive">{formatCurrency(forecast.income)}</strong>
        </div>
        <div className="forecast-line">
          <span>
            <CreditCard size={15} /> Cartão
            <small>
              {forecast.cardIsActual
                ? 'fatura já importada'
                : `${formatCurrency(forecast.installments)} em parcelas + média à vista de ${forecast.averageBase} fatura(s)`}
            </small>
          </span>
          <strong>− {formatCurrency(forecast.card)}</strong>
        </div>
        <div className="forecast-line">
          <span><Receipt size={15} /> Contas fixas</span>
          <strong>− {formatCurrency(forecast.bills)}</strong>
        </div>
        <div className="forecast-line">
          <span>
            <Wallet size={15} /> Gastos avulsos
            {forecast.expensesFromAverage && <small>média dos últimos 3 meses</small>}
          </span>
          <strong>− {formatCurrency(forecast.expenses)}</strong>
        </div>
      </div>

      <div className={`forecast-verdict ${positive ? 'positive' : 'negative'}`}>
        <TrendingUp size={16} />
        <span>
          {!forecast.income
            ? 'Cadastre suas receitas para saber se o mês vai fechar no positivo.'
            : positive
              ? 'Pelo que já está previsto, o mês deve fechar no positivo.'
              : 'Atenção: pelo que já está previsto, as saídas devem passar das receitas.'}
        </span>
      </div>
    </section>
  )
}

export function MonthOverview({
  month,
  onMonthChange,
  invoices,
  bills,
  payments,
  incomes,
  expenses,
  forecast,
  saving,
  onPay,
  onUnpay,
  onOpenInvoice,
  onManage,
  children,
}: MonthOverviewProps) {
  const [payingId, setPayingId] = useState('')
  const [payValue, setPayValue] = useState('')

  const summary = computeMonthSummary(month, { invoices, bills, payments, incomes, expenses })
  const monthBills = billsForMonth(bills, month)
  const paid = paymentsByBill(payments, month)
  const monthIncomes = incomesForMonth(incomes, month)
  const monthInvoices = invoices.filter((invoice) => invoice.referenceMonth === month)

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

  const nothingConfigured = !bills.length && !incomes.length && !expenses.length
  const committed = summary.committed

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
          <strong>{formatCurrency(summary.income)}</strong>
          <small>{summary.incomeCount} entrada(s)</small>
        </article>
        <article className="stat-card purple">
          <div className="stat-top"><span>Cartão</span><CreditCard size={18} /></div>
          <strong>{formatCurrency(summary.card)}</strong>
          <small>{summary.cardCount ? 'Fatura que vence no mês' : 'Nenhuma fatura neste mês'}</small>
        </article>
        <article className="stat-card orange">
          <div className="stat-top"><span>Contas fixas</span><Receipt size={18} /></div>
          <strong>{formatCurrency(summary.bills)}</strong>
          <small>{summary.billsPaidCount} de {summary.billsCount} paga(s)</small>
        </article>
        <article className="stat-card pink">
          <div className="stat-top"><span>Avulsos</span><Wallet size={18} /></div>
          <strong>{formatCurrency(summary.expenses)}</strong>
          <small>{summary.expensesCount} gasto(s) fora do cartão</small>
        </article>
        <article className={`stat-card ${summary.leftover >= 0 ? 'blue' : 'danger'}`}>
          <div className="stat-top"><span>Sobra</span><PiggyBank size={18} /></div>
          <strong>{formatCurrency(summary.leftover)}</strong>
          <small>Receitas − todas as saídas</small>
        </article>
      </section>

      {committed !== null && (
        <section className="panel month-commitment">
          <div className="budget-row-head">
            <strong>Renda comprometida</strong>
            <span>
              {committed.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%{' '}
              <small>de {formatCurrency(summary.income)}</small>
            </span>
          </div>
          <div className={`budget-row ${committed > 100 ? 'over' : committed >= 80 ? 'warning' : 'ok'}`}>
            <div className="budget-bar"><span style={{ width: `${Math.min(committed, 100)}%` }} /></div>
          </div>
          <div className="commitment-split">
            <span><i className="dot card" /> Cartão {formatCurrency(summary.card)}</span>
            <span><i className="dot bills" /> Contas {formatCurrency(summary.bills)}</span>
            <span><i className="dot expenses" /> Avulsos {formatCurrency(summary.expenses)}</span>
          </div>
        </section>
      )}

      <ForecastPanel forecast={forecast} />

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
                <div className="due-amount">{formatCurrency(invoiceNet(invoice))}</div>
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

      {children}

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
