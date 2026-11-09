import { LogOut, Moon, Sun } from 'lucide-react'
import type { Theme } from '../../contexts/UiContext'
import type { InvoiceSummary } from '../../types/Invoice'
import { formatMonthLabel } from '../../utils/invoiceReference'
import type { View } from './ViewTabs'

interface DashboardHeaderProps {
  email: string | null
  theme: Theme
  onToggleTheme: () => void
  onLogout: () => void
  view: View
  month: string
  invoiceMonth: string
  selectedInvoice?: InvoiceSummary
  dueDateLabel: string | null
  fileName: string
  invoiceCount: number
  billCount: number
  incomeCount: number
}

export function DashboardHeader({
  email,
  theme,
  onToggleTheme,
  onLogout,
  view,
  month,
  invoiceMonth,
  selectedInvoice,
  dueDateLabel,
  fileName,
  invoiceCount,
  billCount,
  incomeCount,
}: DashboardHeaderProps) {
  return (
    <header className="hero">
      <div className="hero-inner">
        <div>
          <div className="hero-topline">
            <span className="brand-pill">CONTROLE FINANCEIRO</span>
            <div className="user-session">
              <span>{email}</span>
              <button
                type="button"
                className="theme-toggle"
                onClick={onToggleTheme}
                aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
                title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
              >
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </button>
              <button type="button" onClick={onLogout}>
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
                ? formatMonthLabel(invoiceMonth)
                : 'Nenhuma fatura'
              : formatMonthLabel(month)}
          </strong>
          <small>
            {view === 'invoice'
              ? `${selectedInvoice?.card ? `${selectedInvoice.card} · ` : ''}${
                  dueDateLabel ? `Vencimento ${dueDateLabel} · ` : ''
                }${fileName || 'Importe um arquivo para começar'}`
              : `${invoiceCount} fatura(s) · ${billCount} conta(s) fixa(s) · ${incomeCount} receita(s)`}
          </small>
        </div>
      </div>
    </header>
  )
}
