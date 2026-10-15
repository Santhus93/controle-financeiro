import type { TransactionCategory } from '../types/Transaction'

const STORAGE_KEY = 'controle-financeiro:category-rules:v1'

const DEFAULT_RULES: Array<{ terms: string[]; category: TransactionCategory }> = [
  { terms: ['supermercado', 'supermercados', 'carone', 'atacadao', 'assai'], category: 'Supermercado' },
  { terms: ['uber', '99app', 'estacionamento', 'posto', 'combustivel'], category: 'Transporte' },
  { terms: ['drogaria', 'drog ', 'farmacia', 'wellhub', 'academia'], category: 'Saúde' },
  { terms: ['amazonprime', 'netflix', 'spotify', 'youtube premium', 'disney', 'max.com'], category: 'Assinaturas' },
  { terms: ['restaurante', 'pizzaria', 'padaria', 'ifood', 'chocolates', 'lanchonete', 'cafe '], category: 'Alimentação' },
  { terms: ['cinema', 'show', 'ingresso'], category: 'Lazer' },
  { terms: ['amazon', 'temu', 'mercado livre', 'magazine', 'floricultura'], category: 'Compras' },
  { terms: ['curso', 'escola', 'faculdade', 'udemy'], category: 'Educação' },
  { terms: ['pix no credito'], category: 'Pix / Transferências' },
]

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export function merchantKey(title: string): string {
  return normalize(title)
    .replace(/\bparcela\s*\d+\s*\/\s*\d+\b/g, '')
    .replace(/\d+/g, '')
    .replace(/[^a-z\s*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function loadCustomCategoryRules(): Record<string, TransactionCategory> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveCustomCategory(title: string, category: TransactionCategory): void {
  const rules = loadCustomCategoryRules()
  rules[merchantKey(title)] = category
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
}

export function detectCategory(title: string): TransactionCategory {
  const normalized = normalize(title)
  const custom = loadCustomCategoryRules()[merchantKey(title)]
  if (custom) return custom

  const matchedRule = DEFAULT_RULES.find((rule) =>
    rule.terms.some((term) => normalized.includes(normalize(term))),
  )

  return matchedRule?.category ?? 'Não categorizado'
}
