/** Mensagem de erro para exibir ao usuário a partir de uma causa desconhecida. */
export function getErrorMessage(cause: unknown): string {
  if (cause instanceof Error) return cause.message
  return 'Ocorreu uma falha ao acessar os dados na nuvem.'
}
