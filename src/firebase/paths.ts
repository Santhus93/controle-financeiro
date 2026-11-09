/**
 * Caminhos raiz do Firestore.
 *
 * Hoje os dados ficam em `users/{uid}`. A ideia é que, quando os "Espaços"
 * existirem, o mesmo serviço possa apontar para `spaces/{spaceId}` sem
 * espalhar a montagem do caminho por todos os serviços.
 */
export function userRoot(uid: string): string {
  return `users/${uid}`
}
