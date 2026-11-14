import { describe, it, expect } from 'vitest'
import type { ActiveScope, Space } from '../types/Space'
import { getScopePermissions } from './scopePermissions'

function makeSpace(overrides: Partial<Space> = {}): Space {
  return {
    id: 'space-1',
    name: 'Escritório',
    ownerUid: 'owner-uid',
    memberUids: ['owner-uid'],
    roles: { 'owner-uid': 'owner' },
    createdAt: new Date(),
    ...overrides,
  }
}

function spaceScope(space: Space): ActiveScope {
  return { kind: 'space', space }
}

describe('getScopePermissions', () => {
  it('dá acesso completo ao Pessoal', () => {
    expect(getScopePermissions({ kind: 'personal' }, 'uid-1')).toEqual({
      activeRole: 'personal',
      canEdit: true,
      canManageMembers: false,
      isShared: false,
    })
  })

  it('reconhece o Dono pelo ownerUid, não por roles', () => {
    const space = makeSpace({
      ownerUid: 'uid-1',
      memberUids: ['uid-1'],
      roles: { 'uid-1': 'editor' },
    })

    expect(getScopePermissions(spaceScope(space), 'uid-1')).toEqual({
      activeRole: 'owner',
      canEdit: true,
      canManageMembers: true,
      isShared: true,
    })
  })

  it('dá edição ao Editor sem gestão de membros', () => {
    const space = makeSpace({
      memberUids: ['owner-uid', 'uid-1'],
      roles: { 'owner-uid': 'owner', 'uid-1': 'editor' },
    })

    expect(getScopePermissions(spaceScope(space), 'uid-1')).toEqual({
      activeRole: 'editor',
      canEdit: true,
      canManageMembers: false,
      isShared: true,
    })
  })

  it('deixa o Leitor apenas visualizar', () => {
    const space = makeSpace({
      memberUids: ['owner-uid', 'uid-1'],
      roles: { 'owner-uid': 'owner', 'uid-1': 'viewer' },
    })

    expect(getScopePermissions(spaceScope(space), 'uid-1')).toEqual({
      activeRole: 'viewer',
      canEdit: false,
      canManageMembers: false,
      isShared: true,
    })
  })

  it('cai em Leitor quando o usuário não tem papel', () => {
    const space = makeSpace({
      memberUids: ['owner-uid', 'uid-1'],
      roles: { 'owner-uid': 'owner' },
    })

    expect(getScopePermissions(spaceScope(space), 'uid-1')).toEqual({
      activeRole: 'viewer',
      canEdit: false,
      canManageMembers: false,
      isShared: true,
    })
  })

  it('não torna Dono alguém com "owner" em roles quando o ownerUid é outro', () => {
    const space = makeSpace({
      ownerUid: 'owner-uid',
      memberUids: ['owner-uid', 'uid-1'],
      roles: { 'owner-uid': 'owner', 'uid-1': 'owner' },
    })

    expect(getScopePermissions(spaceScope(space), 'uid-1')).toEqual({
      activeRole: 'viewer',
      canEdit: false,
      canManageMembers: false,
      isShared: true,
    })
  })
})
