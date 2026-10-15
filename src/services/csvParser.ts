import Papa from 'papaparse'
import type { RawNubankRow, Transaction } from '../types/Transaction'
import { parsePtBrCurrency } from '../utils/currency'
import { parseIsoDate } from '../utils/dates'
import { detectCategory } from './categoryEngine'
import { classifyTransaction, cleanInstallmentTitle, extractInstallment } from './transactionClassifier'

const REQUIRED_HEADERS = ['date', 'title', 'amount']

function createId(row: RawNubankRow, index: number): string {
  const seed = `${row.date}|${row.title}|${row.amount}|${index}`
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return `transaction-${Math.abs(hash)}-${index}`
}

export function parseNubankCsv(file: File): Promise<Transaction[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<RawNubankRow>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.trim().toLowerCase(),
      complete: ({ data, errors, meta }) => {
        if (errors.length) {
          reject(new Error(`Não foi possível ler o CSV: ${errors[0].message}`))
          return
        }

        const fields = meta.fields ?? []
        const missing = REQUIRED_HEADERS.filter((header) => !fields.includes(header))
        if (missing.length) {
          reject(new Error(`Colunas obrigatórias não encontradas: ${missing.join(', ')}.`))
          return
        }

        const transactions = data
          .map((row, index): Transaction | null => {
            const originalTitle = String(row.title ?? '').trim()
            const date = String(row.date ?? '').trim()
            if (!originalTitle || !parseIsoDate(date)) return null

            const amount = parsePtBrCurrency(row.amount ?? '')
            const installment = extractInstallment(originalTitle)
            const title = installment ? cleanInstallmentTitle(originalTitle) : originalTitle

            return {
              id: createId(row, index),
              date,
              title,
              originalTitle,
              amount,
              type: classifyTransaction(originalTitle, amount),
              category: detectCategory(originalTitle),
              installment,
            }
          })
          .filter((transaction): transaction is Transaction => transaction !== null)
          .sort((a, b) => b.date.localeCompare(a.date))

        if (!transactions.length) {
          reject(new Error('O arquivo foi lido, mas nenhum lançamento válido foi encontrado.'))
          return
        }

        resolve(transactions)
      },
      error: (error) => reject(new Error(error.message)),
    })
  })
}
