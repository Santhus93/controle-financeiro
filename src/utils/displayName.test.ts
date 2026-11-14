import { describe, it, expect } from 'vitest'
import {
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  normalizeDisplayName,
  validateDisplayName,
} from './displayName'

describe('normalizeDisplayName', () => {
  it('remove os espaços das pontas', () => {
    expect(normalizeDisplayName('  Ana Maria  ')).toBe('Ana Maria')
  })

  it('devolve string vazia quando só há espaços', () => {
    expect(normalizeDisplayName('   ')).toBe('')
  })
})

describe('validateDisplayName', () => {
  it('aceita nome válido e devolve o valor normalizado', () => {
    expect(validateDisplayName('  Ana  ')).toEqual({ ok: true, name: 'Ana' })
  })

  it('recusa nome vazio', () => {
    const result = validateDisplayName('   ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain(String(DISPLAY_NAME_MIN_LENGTH))
  })

  it('recusa nome com menos de 2 caracteres', () => {
    expect(validateDisplayName(' A ').ok).toBe(false)
  })

  it('aceita exatamente o tamanho máximo', () => {
    const name = 'a'.repeat(DISPLAY_NAME_MAX_LENGTH)
    expect(validateDisplayName(name)).toEqual({ ok: true, name })
  })

  it('recusa nome acima do tamanho máximo', () => {
    const result = validateDisplayName('a'.repeat(DISPLAY_NAME_MAX_LENGTH + 1))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain(String(DISPLAY_NAME_MAX_LENGTH))
  })
})
