/**
 * Caminhos raiz do Firestore.
 *
 * - Dados pessoais: `users/{uid}`
 * - Espaços compartilhados: `spaces/{spaceId}`
 *
 * `scopeRoot` centraliza a escolha para que os serviços não precisem
 * conhecer o tipo do escopo.
 */
import type { ActiveScope } from '../types/Space'

export function userRoot(uid: string): string {
  return `users/${uid}`
}

export function spaceRoot(spaceId: string): string {
  return `spaces/${spaceId}`
}

export function scopeRoot(uid: string, scope: ActiveScope): string {
  return scope.kind === 'space' ? spaceRoot(scope.space.id) : userRoot(uid)
}
