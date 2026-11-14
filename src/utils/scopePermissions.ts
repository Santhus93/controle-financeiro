import type { ActiveScope, SpaceRole } from '../types/Space'

/** Papel efetivo do escopo ativo: o Pessoal não tem papel de espaço. */
export type EffectiveRole = 'personal' | SpaceRole

export interface ScopePermissions {
  activeRole: EffectiveRole
  canEdit: boolean
  canManageMembers: boolean
  isShared: boolean
}

/**
 * Deriva as permissões visuais do escopo ativo em um único lugar.
 *
 * O dono é decidido exclusivamente por `ownerUid`. Um valor "owner" em
 * `roles[uid]` sem o uid correspondente em `ownerUid` não concede poderes.
 * Papel ausente ou desconhecido cai em Leitor.
 *
 * A segurança real continua no Firestore; isto serve apenas para a interface.
 */
export function getScopePermissions(
  scope: ActiveScope,
  uid: string | undefined,
): ScopePermissions {
  if (scope.kind === 'personal' || !uid) {
    return {
      activeRole: 'personal',
      canEdit: true,
      canManageMembers: false,
      isShared: false,
    }
  }

  const storedRole = scope.space.roles?.[uid]
  const role: SpaceRole =
    scope.space.ownerUid === uid
      ? 'owner'
      : storedRole === 'editor'
        ? 'editor'
        : 'viewer'

  return {
    activeRole: role,
    canEdit: role === 'owner' || role === 'editor',
    canManageMembers: role === 'owner',
    isShared: true,
  }
}
