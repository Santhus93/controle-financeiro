/** Nome de exibição do usuário: usado na autoria dos espaços compartilhados. */
export const DISPLAY_NAME_MIN_LENGTH = 2
export const DISPLAY_NAME_MAX_LENGTH = 40

export type DisplayNameValidationResult =
  | { ok: true; name: string }
  | { ok: false; error: string }

/** Remove apenas os espaços das pontas, sem alterar o miolo do nome. */
export function normalizeDisplayName(value: string): string {
  return value.trim()
}

/** Valida e devolve o nome já normalizado. Nunca devolve texto vazio. */
export function validateDisplayName(value: string): DisplayNameValidationResult {
  const name = normalizeDisplayName(value)

  if (name.length < DISPLAY_NAME_MIN_LENGTH) {
    return {
      ok: false,
      error: `O nome precisa ter pelo menos ${DISPLAY_NAME_MIN_LENGTH} caracteres.`,
    }
  }

  if (name.length > DISPLAY_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `O nome pode ter no máximo ${DISPLAY_NAME_MAX_LENGTH} caracteres.`,
    }
  }

  return { ok: true, name }
}
