/**
 * Autoria de criação de documentos em espaços compartilhados.
 *
 * O Pessoal não grava autoria. A segurança real continua no Firestore:
 * estes campos são informativos nesta etapa.
 */
export interface Actor {
  uid: string
  name?: string
  email?: string
}

export interface CreatedBy {
  uid: string
  name?: string
  email?: string
}

/** Campos opcionais para manter compatibilidade com documentos antigos. */
export interface Authorship {
  createdBy?: CreatedBy
  createdAt?: Date
}
