import { describe, expect, it } from 'vitest'
import { buildInviteId, buildInviteMessage, isValidEmail, normalizeEmail, ROLE_LABELS } from './invites'

describe('normalizeEmail', () => {
  it('remove espaços e passa para minúsculas', () => {
    expect(normalizeEmail('  Fulano@Exemplo.COM ')).toBe('fulano@exemplo.com')
  })
})

describe('isValidEmail', () => {
  it('aceita e-mail comum', () => {
    expect(isValidEmail('fulano@exemplo.com')).toBe(true)
  })

  it('aceita e-mail com maiúsculas e espaços nas pontas', () => {
    expect(isValidEmail(' Fulano@Exemplo.com ')).toBe(true)
  })

  it.each(['', 'fulano', 'fulano@', '@exemplo.com', 'fulano@exemplo', 'ful ano@exemplo.com', 'a/b@exemplo.com'])(
    'recusa "%s"',
    (value) => {
      expect(isValidEmail(value)).toBe(false)
    },
  )
})

describe('buildInviteId', () => {
  it('junta o id do espaço com o e-mail normalizado', () => {
    expect(buildInviteId('abc123', ' Fulano@Exemplo.com')).toBe('abc123_fulano@exemplo.com')
  })

  it('gera o mesmo id para o mesmo e-mail escrito de formas diferentes', () => {
    expect(buildInviteId('x', 'A@B.com')).toBe(buildInviteId('x', 'a@b.com'))
  })
})

describe('buildInviteMessage', () => {
  const message = buildInviteMessage('Escritório', 'Fulano@Exemplo.com', 'https://app.exemplo/')

  it('cita o espaço, o link e o e-mail normalizado', () => {
    expect(message).toContain('"Escritório"')
    expect(message).toContain('https://app.exemplo/')
    expect(message).toContain('fulano@exemplo.com')
  })

  it('orienta a confirmar o e-mail antes de aceitar', () => {
    expect(message).toContain('Confirme o e-mail')
  })
})

describe('ROLE_LABELS', () => {
  it('traduz os três papéis', () => {
    expect(ROLE_LABELS).toEqual({ owner: 'Dono', editor: 'Editor', viewer: 'Leitor' })
  })
})
