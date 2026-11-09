// src/types/Space.ts
export interface Space {
  id: string
  name: string
  ownerUid: string
  memberUids: string[]
  roles: Record<string, 'owner' | 'editor' | 'viewer'>
  createdAt: Date
}

/** Escopo ativo: dados pessoais do usuário ou de um Espaço. */
export type ActiveScope =
  | { kind: 'personal' }
  | { kind: 'space'; space: Space }
