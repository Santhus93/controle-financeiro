// src/types/Space.ts
export type SpaceRole = 'owner' | 'editor' | 'viewer'
export type InviteRole = Exclude<SpaceRole, 'owner'>

export interface MemberInfo {
  email: string
  name?: string
}

export interface Space {
  id: string
  name: string
  ownerUid: string
  memberUids: string[]
  roles: Record<string, SpaceRole>
  /** E-mail e nome de cada membro (espaços antigos podem não ter). */
  memberInfo?: Record<string, MemberInfo>
  createdAt: Date
}

/** Escopo ativo: dados pessoais do usuário ou de um Espaço. */
export type ActiveScope =
  | { kind: 'personal' }
  | { kind: 'space'; space: Space }

/** Convite pendente, guardado em invites/{spaceId}_{email}. */
export interface Invite {
  id: string
  spaceId: string
  spaceName: string
  email: string
  role: InviteRole
  ownerUid: string
  invitedByEmail: string
  createdAt: Date | null
}
