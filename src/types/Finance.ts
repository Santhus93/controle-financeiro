/**
 * Contas fixas e receitas.
 * Regra do app: conta fixa é tudo o que NÃO passa pelo cartão de crédito.
 * O que é pago no cartão aparece só na fatura, para não contar duas vezes.
 */
export const BILL_CATEGORIES = [
  'Moradia',
  'Condomínio',
  'Energia',
  'Água',
  'Gás',
  'Internet / Telefone',
  'Educação',
  'Saúde',
  'Seguros',
  'Impostos',
  'Transporte',
  'Outros',
] as const

export type BillCategory = (typeof BILL_CATEGORIES)[number]

export interface Bill {
  id: string
  name: string
  category: BillCategory
  /** Dia do vencimento (1 a 31). Em meses mais curtos, vence no último dia. */
  dueDay: number
  /** Valor fixo ou valor estimado (contas variáveis). */
  amount: number
  /** true = valor muda todo mês (água, luz); o valor real é informado ao pagar. */
  variable: boolean
  /** Primeiro mês em que a conta existe (AAAA-MM). */
  startMonth: string
}

export interface BillPayment {
  /** {mês}_{billId} */
  id: string
  billId: string
  month: string
  amount: number
}

export interface Income {
  id: string
  name: string
  amount: number
  /** true = todo mês a partir de "month"; false = só no mês "month". */
  recurring: boolean
  month: string
  /** Dia em que costuma entrar. */
  day: number
}

export type NewBill = Omit<Bill, 'id'> & { id?: string }
export type NewIncome = Omit<Income, 'id'> & { id?: string }
