import { describe, it, expect } from 'vitest'
import { normalizeActor, optimisticAuthorship, readAuthorship, withAuthorship } from './authorship'

/** Timestamp falso no formato do Firestore (apenas toDate). */
function fakeTimestamp(iso: string) {
  return { toDate: () => new Date(iso) }
}

describe('normalizeActor', () => {
  it('mantém uid, name e email de um Actor completo', () => {
    expect(
      normalizeActor({ uid: 'uid-1', name: 'Ana', email: 'ana@exemplo.com' }),
    ).toEqual({ uid: 'uid-1', name: 'Ana', email: 'ana@exemplo.com' })
  })

  it('aceita Actor somente com uid', () => {
    expect(normalizeActor({ uid: 'uid-1' })).toEqual({ uid: 'uid-1' })
  })

  it('não grava name vazio', () => {
    const result = normalizeActor({ uid: 'uid-1', name: '   ' })
    expect(result).toEqual({ uid: 'uid-1' })
    expect(result && 'name' in result).toBe(false)
  })

  it('não grava email vazio', () => {
    const result = normalizeActor({ uid: 'uid-1', email: '' })
    expect(result).toEqual({ uid: 'uid-1' })
    expect(result && 'email' in result).toBe(false)
  })

  it('devolve undefined sem Actor', () => {
    expect(normalizeActor(undefined)).toBeUndefined()
  })

  it('não inclui campos undefined no objeto final', () => {
    const result = normalizeActor({ uid: ' uid-1 ', name: undefined, email: undefined })
    expect(result).toEqual({ uid: 'uid-1' })
    expect(Object.values(result ?? {})).not.toContain(undefined)
  })
})

describe('readAuthorship', () => {
  it('devolve objeto vazio para documento antigo sem autoria', () => {
    expect(readAuthorship({ name: 'Aluguel', amount: 1000 })).toEqual({})
  })

  it('converte Timestamp válido em Date', () => {
    const result = readAuthorship({
      createdBy: { uid: 'uid-1', name: 'Ana', email: 'ana@exemplo.com' },
      createdAt: fakeTimestamp('2026-05-01T10:00:00.000Z'),
    })

    expect(result.createdBy).toEqual({ uid: 'uid-1', name: 'Ana', email: 'ana@exemplo.com' })
    expect(result.createdAt).toBeInstanceOf(Date)
    expect(result.createdAt?.toISOString()).toBe('2026-05-01T10:00:00.000Z')
  })

  it('trata createdBy inválido ou parcial sem erro', () => {
    expect(readAuthorship({ createdBy: 'quem' })).toEqual({})
    expect(readAuthorship({ createdBy: { name: 'Sem uid' } })).toEqual({})
    expect(readAuthorship({ createdBy: { uid: 'uid-1' }, createdAt: 'ontem' })).toEqual({
      createdBy: { uid: 'uid-1' },
    })
    expect(readAuthorship(null)).toEqual({})
    expect(readAuthorship(undefined)).toEqual({})
  })

  it('ignora Timestamp que lança erro', () => {
    const createdAt = {
      toDate: () => {
        throw new Error('inválido')
      },
    }

    expect(readAuthorship({ createdAt })).toEqual({})
  })
})

describe('optimisticAuthorship', () => {
  it('devolve createdBy normalizado e Date em createdAt', () => {
    const result = optimisticAuthorship({ uid: 'uid-1', name: 'Ana' })

    expect(result.createdBy).toEqual({ uid: 'uid-1', name: 'Ana' })
    expect(result.createdAt).toBeInstanceOf(Date)
  })

  it('devolve objeto vazio sem Actor', () => {
    expect(optimisticAuthorship(undefined)).toEqual({})
  })
})

describe('withAuthorship', () => {
  it('preserva a autoria anterior quando a edição não devolve autoria', () => {
    const createdAt = new Date('2026-05-01T10:00:00.000Z')
    const previous = { id: 'bill-1', createdBy: { uid: 'uid-1' }, createdAt }
    const saved = { id: 'bill-1', name: 'Luz' }

    expect(withAuthorship(saved, previous)).toEqual({
      id: 'bill-1',
      name: 'Luz',
      createdBy: { uid: 'uid-1' },
      createdAt,
    })
  })

  it('mantém a autoria recém-criada quando não há item anterior', () => {
    const saved = { id: 'bill-1', createdBy: { uid: 'uid-1' }, createdAt: new Date() }
    expect(withAuthorship(saved, undefined)).toEqual(saved)
  })
})
