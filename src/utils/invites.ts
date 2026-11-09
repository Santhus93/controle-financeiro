import type { SpaceRole } from '../types/Space'

export const ROLE_LABELS: Record<SpaceRole, string> = {
  owner: 'Dono',
  editor: 'Editor',
  viewer: 'Leitor',
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: string): boolean {
  const value = normalizeEmail(email)
  return /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(value)
}

/** Id do documento do convite: um convite por espaço e e-mail. */
export function buildInviteId(spaceId: string, email: string): string {
  return `${spaceId}_${normalizeEmail(email)}`
}

/** Texto para o dono enviar por WhatsApp ou e-mail (o app não envia e-mails sozinho). */
export function buildInviteMessage(spaceName: string, email: string, appUrl: string): string {
  return [
    `Oi! Te convidei para o espaço "${spaceName}" no Minha Fatura.`,
    '',
    `1. Acesse ${appUrl}`,
    `2. Clique em "Criar conta" usando este e-mail: ${normalizeEmail(email)}`,
    '3. Confirme o e-mail pelo link que vai chegar na sua caixa de entrada',
    '4. Abra o seletor de espaços, no topo, e aceite o convite',
    '',
    'Se preferir, entre com a conta Google desse mesmo e-mail.',
  ].join('\n')
}
