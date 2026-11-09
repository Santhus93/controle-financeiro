import { BarChart3, CalendarDays, CreditCard, Receipt } from 'lucide-react'

export type View = 'month' | 'invoice' | 'bills' | 'history'

interface ViewTabsProps {
  view: View
  onChange: (view: View) => void
}

export function ViewTabs({ view, onChange }: ViewTabsProps) {
  return (
    <nav className="view-tabs four" aria-label="Navegação principal">
      <button type="button" className={view === 'month' ? 'active' : ''} onClick={() => onChange('month')}>
        <CalendarDays size={18} /> <span>Meu mês</span>
      </button>
      <button type="button" className={view === 'invoice' ? 'active' : ''} onClick={() => onChange('invoice')}>
        <CreditCard size={18} /> <span>Cartão</span>
      </button>
      <button type="button" className={view === 'bills' ? 'active' : ''} onClick={() => onChange('bills')}>
        <Receipt size={18} /> <span>Contas</span>
      </button>
      <button type="button" className={view === 'history' ? 'active' : ''} onClick={() => onChange('history')}>
        <BarChart3 size={18} /> <span>Histórico</span>
      </button>
    </nav>
  )
}
