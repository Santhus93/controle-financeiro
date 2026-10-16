import type { TransactionCategory } from '../types/Transaction'

const LEGACY_STORAGE_KEY = 'controle-financeiro:category-rules:v1'

export type CategoryRuleMap = Record<string, TransactionCategory>

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

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

/**
 * Chave do estabelecimento usada pelo De-Para.
 * Remove acentos, números, "Parcela x/y" e pontuação, para que
 * lançamentos do mesmo estabelecimento gerem a mesma chave.
 */
export function merchantKey(title: string): string {
  return normalizeText(title)
    .replace(/\bparcela\s*\d+\s*\/\s*\d+\b/g, '')
    .replace(/\d+/g, '')
    .replace(/[^a-z\s*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Prioridade:
 * 1. regra personalizada do usuário (Firestore)
 * 2. regras padrão do sistema
 * 3. "Não categorizado"
 */
export function detectCategory(
  title: string,
  customRules: CategoryRuleMap = {},
): TransactionCategory {
  const custom = customRules[merchantKey(title)]
  if (custom) return custom

  const normalized = normalizeText(title)
  const matchedRule = DEFAULT_RULES.find((rule) =>
    rule.terms.some((term) => normalized.includes(normalizeText(term))),
  )

  return matchedRule?.category ?? 'Não categorizado'
}

/** Regras antigas da V1, salvas no localStorage do navegador. */
export function readLegacyLocalRules(): CategoryRuleMap {
  try {
    const parsed = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? (parsed as CategoryRuleMap) : {}
  } catch {
    return {}
  }
}

export function clearLegacyLocalRules(): void {
  localStorage.removeItem(LEGACY_STORAGE_KEY)
}
