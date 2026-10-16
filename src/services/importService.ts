import type { Transaction } from '../types/Transaction'
import { formatCurrency } from '../utils/currency'
import { parseNubankCsv } from './csvParser'
import { parseOfx } from './ofxParser'

export interface ImportedStatement {
  format: 'ofx' | 'csv'
  card: string
  transactions: Transaction[]
  ledgerBalance: number | null
}

export const ACCEPTED_EXTENSIONS = ['.ofx', '.qfx', '.csv']

/** Escolhe o leitor pela extensão. OFX serve para qualquer banco; CSV é o layout do Nubank. */
export async function importStatement(file: File): Promise<ImportedStatement> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.ofx') || name.endsWith('.qfx')) {
    const statement = await parseOfx(file)
    return {
      format: 'ofx',
      card: statement.bankName,
      transactions: statement.transactions,
      ledgerBalance: statement.ledgerBalance,
    }
  }

  if (name.endsWith('.csv')) {
    return {
      format: 'csv',
      card: 'Nubank',
      transactions: await parseNubankCsv(file),
      ledgerBalance: null,
    }
  }

  throw new Error('Formato não suportado. Envie um arquivo OFX (qualquer banco) ou o CSV do Nubank.')
}

/**
 * Confere a soma dos lançamentos com o saldo informado pelo banco no OFX.
 * Gastos − estornos deve bater com o saldo da fatura.
 */
export function describeLedgerCheck(statement: ImportedStatement): string {
  if (statement.ledgerBalance === null) return ''

  const expenses = statement.transactions
    .filter((item) => ['purchase', 'installment', 'pix_credit'].includes(item.type) && item.amount > 0)
    .reduce((total, item) => total + item.amount, 0)

  const refunds = statement.transactions
    .filter((item) => item.type === 'refund')
    .reduce((total, item) => total + Math.abs(item.amount), 0)

  const computed = Math.round((expenses - refunds) * 100) / 100
  const informed = Math.abs(statement.ledgerBalance)

  if (Math.abs(computed - informed) < 0.01) {
    return ` Conferência OK: os lançamentos fecham com o saldo do banco (${formatCurrency(informed)}).`
  }

  return ` Atenção: os lançamentos somam ${formatCurrency(computed)} e o banco informa ${formatCurrency(informed)}. A diferença pode vir de saldo anterior ou encargos.`
}
