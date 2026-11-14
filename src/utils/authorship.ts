import type { Actor, Authorship, CreatedBy } from '../types/Author'

/**
 * Normaliza o Actor para gravação/retorno otimista.
 * Nunca devolve propriedades com valor `undefined` (o Firestore rejeita).
 */
export function normalizeActor(actor?: Actor): CreatedBy | undefined {
  if (!actor) return undefined

  const uid = typeof actor.uid === 'string' ? actor.uid.trim() : ''
  if (!uid) return undefined

  const name = typeof actor.name === 'string' ? actor.name.trim() : ''
  const email = typeof actor.email === 'string' ? actor.email.trim() : ''

  return {
    uid,
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
  }
}

/** Converte Timestamp do Firestore, Date ou valor inválido em Date opcional. */
function toOptionalDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value
  }

  if (value && typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    try {
      const converted = (value as { toDate: () => unknown }).toDate()
      if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
        return converted
      }
    } catch {
      // Campo inválido: ignora em vez de quebrar a leitura.
    }
  }

  return undefined
}

/**
 * Lê a autoria de um documento sem lançar erro.
 * Documentos antigos (sem autoria) devolvem objeto vazio.
 */
export function readAuthorship(data: Record<string, unknown> | null | undefined): Authorship {
  const result: Authorship = {}
  if (!data) return result

  const rawCreatedBy = data.createdBy
  if (rawCreatedBy && typeof rawCreatedBy === 'object') {
    const createdBy = normalizeActor(rawCreatedBy as Actor)
    if (createdBy) result.createdBy = createdBy
  }

  const createdAt = toOptionalDate(data.createdAt)
  if (createdAt) result.createdAt = createdAt

  return result
}

/** Autoria para o retorno otimista dos serviços (antes do servidor responder). */
export function optimisticAuthorship(actor?: Actor): Authorship {
  const createdBy = normalizeActor(actor)
  if (!createdBy) return {}
  return { createdBy, createdAt: new Date() }
}

/**
 * Mantém a autoria já conhecida ao substituir um item na lista local.
 * Usado na edição, quando o serviço grava com merge e não reenvia autoria.
 */
export function withAuthorship<T extends { id: string } & Authorship>(
  saved: T,
  previous?: Authorship,
): T {
  const createdBy = previous?.createdBy ?? saved.createdBy
  const createdAt = previous?.createdAt ?? saved.createdAt

  if (!createdBy && !createdAt) return saved

  return {
    ...saved,
    ...(createdBy ? { createdBy } : {}),
    ...(createdAt ? { createdAt } : {}),
  }
}

/**
 * Texto de apresentação da autoria: nome, senão e-mail, senão null.
 * Nunca devolve string vazia.
 */
export function formatAuthorLabel(authorship?: Authorship | null): string | null {
  const createdBy = authorship?.createdBy
  if (!createdBy) return null

  const name = typeof createdBy.name === 'string' ? createdBy.name.trim() : ''
  if (name) return name

  const email = typeof createdBy.email === 'string' ? createdBy.email.trim() : ''
  if (email) return email

  return null
}
