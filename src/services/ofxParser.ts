import type { Transaction } from '../types/Transaction'
import { detectCategory } from './categoryEngine'
import {
  classifyTransaction,
  cleanInstallmentTitle,
  extractInstallment,
} from './transactionClassifier'

/**
 * Leitor de OFX (padrão usado pelos bancos para exportar extratos e faturas).
 *
 * Suporta:
 * - OFX 1.x (SGML), com ou sem tag de fechamento nos campos
 * - OFX 2.x (XML)
 * - arquivos em Windows-1252 (Nubank: CHARSET:1252) ou UTF-8
 * - valores com ponto ou vírgula decimal
 *
 * Convenção interna (igual ao CSV do Nubank):
 *   compra   = valor positivo
 *   crédito  = valor negativo (pagamento, estorno)
 * No OFX é o contrário (débito negativo), por isso o sinal é invertido.
 */

export interface OfxStatement {
  transactions: Transaction[]
  bankName: string
  currency: string
  /** Saldo informado pelo banco (LEDGERBAL), quando existir. */
  ledgerBalance: number | null
}

function detectEncoding(header: string): string {
  if (/encoding\s*=\s*["']?utf-?8/i.test(header)) return 'utf-8'
  if (/CHARSET:\s*(1252|ISO-?8859-?1|8859-1)/i.test(header)) return 'windows-1252'
  return 'utf-8'
}

async function readOfxText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const header = new TextDecoder('ascii').decode(buffer.slice(0, 1024))
  const encoding = detectEncoding(header)
  const text = new TextDecoder(encoding).decode(buffer)

  // Se o cabeçalho diz UTF-8 mas o conteúdo é Windows-1252, aparecem caracteres inválidos.
  if (encoding === 'utf-8' && text.includes('\uFFFD')) {
    return new TextDecoder('windows-1252').decode(buffer)
  }

  return text
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
}

/** Lê o valor de um campo simples, com ou sem tag de fechamento. */
function readTag(block: string, tag: string): string {
  const match = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i').exec(block)
  return match ? decodeEntities(match[1].trim()) : ''
}

/** 20261015000000[-3:BRT] -> 2026-10-15 */
function parseOfxDate(value: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(value)
  if (!match) return null

  const [, year, month, day] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  if (Number.isNaN(date.getTime()) || date.getMonth() !== Number(month) - 1) return null

  return `${year}-${month}-${day}`
}

/** Aceita -11.00, -11,00, 1.234,56 e 1,234.56 */
function parseOfxAmount(value: string): number | null {
  let normalized = value.replace(/\s/g, '')
  if (!normalized) return null

  const lastComma = normalized.lastIndexOf(',')
  const lastDot = normalized.lastIndexOf('.')

  if (lastComma > lastDot) {
    normalized = normalized.replace(/\./g, '').replace(',', '.')
  } else {
    normalized = normalized.replace(/,/g, '')
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function detectBankName(org: string): string {
  const normalized = org.toUpperCase()
  if (/NU PAGAMENTOS|NUBANK/.test(normalized)) return 'Nubank'
  if (/ITAU|ITAÚ/.test(normalized)) return 'Itaú'
  if (/BRADESCO/.test(normalized)) return 'Bradesco'
  if (/SANTANDER/.test(normalized)) return 'Santander'
  if (/BANCO DO BRASIL/.test(normalized)) return 'Banco do Brasil'
  if (/CAIXA/.test(normalized)) return 'Caixa'
  if (/INTER/.test(normalized)) return 'Inter'
  if (/C6/.test(normalized)) return 'C6 Bank'
  if (!org.trim()) return 'Cartão'

  return org
    .toLowerCase()
    .replace(/\b(s\.?a\.?|ltda)\b\.?/g, '')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function createId(seed: string, index: number): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return `transaction-${Math.abs(hash)}-${index}`
}

export async function parseOfx(file: File): Promise<OfxStatement> {
  const text = await readOfxText(file)

  if (!/<OFX>/i.test(text)) {
    throw new Error('O arquivo não parece ser um OFX válido.')
  }

  const blocks = [...text.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)].map((match) => match[1])

  if (!blocks.length) {
    throw new Error('Nenhum lançamento foi encontrado no arquivo OFX.')
  }

  const transactions: Transaction[] = []

  blocks.forEach((block, index) => {
    const date = parseOfxDate(readTag(block, 'DTPOSTED'))
    const ofxAmount = parseOfxAmount(readTag(block, 'TRNAMT'))
    const originalTitle = readTag(block, 'MEMO') || readTag(block, 'NAME')

    if (!date || ofxAmount === null || !originalTitle) return

    // OFX: débito negativo. Interno: compra positiva.
    const amount = Math.round(-ofxAmount * 100) / 100 || 0
    const installment = extractInstallment(originalTitle)
    let type = classifyTransaction(originalTitle, amount)

    // Crédito que não é pagamento nem estorno identificado: tratado como estorno.
    if (type === 'other' && amount < 0) type = 'refund'

    transactions.push({
      // Não usamos o FITID como id: o Nubank repete o mesmo FITID em lançamentos diferentes.
      id: createId(`${date}|${originalTitle}|${amount}`, index),
      date,
      title: installment ? cleanInstallmentTitle(originalTitle) : originalTitle,
      originalTitle,
      amount,
      type,
      category: detectCategory(originalTitle),
      installment,
    })
  })

  if (!transactions.length) {
    throw new Error('O OFX foi lido, mas nenhum lançamento válido foi encontrado.')
  }

  const ledgerBlock = /<LEDGERBAL>([\s\S]*?)<\/LEDGERBAL>/i.exec(text)?.[1] ?? ''

  return {
    transactions: transactions.sort((a, b) => b.date.localeCompare(a.date)),
    bankName: detectBankName(readTag(text, 'ORG')),
    currency: readTag(text, 'CURDEF') || 'BRL',
    ledgerBalance: ledgerBlock ? parseOfxAmount(readTag(ledgerBlock, 'BALAMT')) : null,
  }
}
