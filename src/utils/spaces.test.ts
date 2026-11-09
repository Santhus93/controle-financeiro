// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest'
import { userRoot, spaceRoot, scopeRoot } from '../firebase/paths'
import type { ActiveScope } from '../types/Space'

// ---- scopeRoot ----------------------------------------------------------------

describe('userRoot', () => {
  it('retorna o caminho correto para um uid', () => {
    expect(userRoot('abc123')).toBe('users/abc123')
  })
})

describe('spaceRoot', () => {
  it('retorna o caminho correto para um spaceId', () => {
    expect(spaceRoot('space-xyz')).toBe('spaces/space-xyz')
  })
})

describe('scopeRoot', () => {
  it('devolve userRoot quando o escopo é personal', () => {
    const scope: ActiveScope = { kind: 'personal' }
    expect(scopeRoot('uid-001', scope)).toBe('users/uid-001')
  })

  it('devolve spaceRoot quando o escopo é space', () => {
    const scope: ActiveScope = {
      kind: 'space',
      space: {
        id: 'space-abc',
        name: 'Família',
        ownerUid: 'uid-001',
        memberUids: ['uid-001'],
        roles: { 'uid-001': 'owner' },
        createdAt: new Date(),
      },
    }
    expect(scopeRoot('uid-001', scope)).toBe('spaces/space-abc')
  })

  it('usa o id do espaço, não o uid do usuário', () => {
    const scope: ActiveScope = {
      kind: 'space',
      space: {
        id: 'espaco-999',
        name: 'Trabalho',
        ownerUid: 'uid-002',
        memberUids: ['uid-002', 'uid-001'],
        roles: { 'uid-002': 'owner', 'uid-001': 'editor' },
        createdAt: new Date(),
      },
    }
    // O uid passado não influencia o resultado quando o escopo é space
    expect(scopeRoot('uid-001', scope)).toBe('spaces/espaco-999')
    expect(scopeRoot('uid-002', scope)).toBe('spaces/espaco-999')
  })
})

// ---- localStorage: activeScope -----------------------------------------------

function readSavedScope(uid: string, available: { id: string; name: string }[]): ActiveScope {
  // Replicação mínima da função do Dashboard para testar isoladamente
  try {
    const raw = localStorage.getItem(`activeScope:${uid}`)
    if (!raw) return { kind: 'personal' }
    const parsed = JSON.parse(raw) as { kind: string; spaceId?: string }
    if (parsed.kind === 'space' && parsed.spaceId) {
      const found = available.find((s) => s.id === parsed.spaceId)
      if (found) {
        return {
          kind: 'space',
          space: {
            id: found.id,
            name: found.name,
            ownerUid: '',
            memberUids: [],
            roles: {},
            createdAt: new Date(),
          },
        }
      }
    }
  } catch {
    // ignore
  }
  return { kind: 'personal' }
}

function writeSavedScope(uid: string, scope: ActiveScope): void {
  if (scope.kind === 'personal') {
    localStorage.removeItem(`activeScope:${uid}`)
  } else {
    localStorage.setItem(
      `activeScope:${uid}`,
      JSON.stringify({ kind: 'space', spaceId: scope.space.id }),
    )
  }
}

describe('activeScope localStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('retorna personal quando não há nada salvo', () => {
    const scope = readSavedScope('uid-1', [])
    expect(scope.kind).toBe('personal')
  })

  it('persiste e restaura um espaço existente', () => {
    const spaces = [{ id: 'sp-1', name: 'Família' }]
    writeSavedScope('uid-1', {
      kind: 'space',
      space: {
        id: 'sp-1',
        name: 'Família',
        ownerUid: 'uid-1',
        memberUids: ['uid-1'],
        roles: { 'uid-1': 'owner' },
        createdAt: new Date(),
      },
    })

    const scope = readSavedScope('uid-1', spaces)
    expect(scope.kind).toBe('space')
    if (scope.kind === 'space') {
      expect(scope.space.id).toBe('sp-1')
      expect(scope.space.name).toBe('Família')
    }
  })

  it('cai para personal se o espaço não existe mais na lista', () => {
    writeSavedScope('uid-1', {
      kind: 'space',
      space: {
        id: 'sp-deletado',
        name: 'Antigo',
        ownerUid: 'uid-1',
        memberUids: ['uid-1'],
        roles: { 'uid-1': 'owner' },
        createdAt: new Date(),
      },
    })

    // Passa lista vazia — espaço não existe mais
    const scope = readSavedScope('uid-1', [])
    expect(scope.kind).toBe('personal')
  })

  it('write/read é idempotente para personal', () => {
    writeSavedScope('uid-1', { kind: 'personal' })
    expect(localStorage.getItem('activeScope:uid-1')).toBeNull()
    const scope = readSavedScope('uid-1', [])
    expect(scope.kind).toBe('personal')
  })

  it('escopos de uids diferentes não se interferem', () => {
    const spaces = [{ id: 'sp-A', name: 'A' }]
    writeSavedScope('uid-A', {
      kind: 'space',
      space: {
        id: 'sp-A',
        name: 'A',
        ownerUid: 'uid-A',
        memberUids: ['uid-A'],
        roles: { 'uid-A': 'owner' },
        createdAt: new Date(),
      },
    })

    expect(readSavedScope('uid-A', spaces).kind).toBe('space')
    expect(readSavedScope('uid-B', spaces).kind).toBe('personal')
  })

  it('JSON inválido no localStorage cai para personal', () => {
    localStorage.setItem('activeScope:uid-x', '{invalid json}')
    expect(readSavedScope('uid-x', []).kind).toBe('personal')
  })
})
