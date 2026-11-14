import { serverTimestamp, type FieldValue } from 'firebase/firestore'
import type { Actor, CreatedBy } from '../types/Author'
import { normalizeActor } from '../utils/authorship'

export interface ServerAuthorshipFields {
  createdBy: CreatedBy
  createdAt: FieldValue
}

/**
 * Campos de autoria para gravação no Firestore.
 * Sem Actor (Pessoal), devolve objeto vazio para não gravar nada.
 */
export function createAuthorshipFields(
  actor?: Actor,
): ServerAuthorshipFields | Record<string, never> {
  const createdBy = normalizeActor(actor)
  if (!createdBy) return {}
  return { createdBy, createdAt: serverTimestamp() }
}
