import { describe, expect, it } from 'vitest'
import { FirebaseError } from 'firebase/app'
import { getAuthErrorMessage } from './authErrors'

const FALLBACK = 'Não foi possível concluir. Tente novamente.'

function messageFor(code: string): string {
  return getAuthErrorMessage(new FirebaseError(code, 'mensagem técnica'))
}

describe('getAuthErrorMessage', () => {
  it.each([
    ['auth/invalid-credential', 'E-mail ou senha incorretos.'],
    ['auth/invalid-login-credentials', 'E-mail ou senha incorretos.'],
    ['auth/user-not-found', 'E-mail ou senha incorretos.'],
    ['auth/wrong-password', 'E-mail ou senha incorretos.'],
    ['auth/invalid-email', 'Informe um e-mail válido.'],
    ['auth/missing-password', 'Informe a senha.'],
    ['auth/weak-password', 'A senha precisa ter pelo menos 6 caracteres.'],
    [
      'auth/email-already-in-use',
      'Este e-mail já está cadastrado. Entre com a sua senha ou recupere o acesso.',
    ],
    [
      'auth/too-many-requests',
      'Muitas tentativas de acesso. Aguarde um pouco e tente novamente.',
    ],
    ['auth/network-request-failed', 'Sem conexão com o servidor. Verifique sua internet.'],
    ['auth/user-disabled', 'Este acesso foi desativado.'],
    ['auth/unauthorized-domain', 'Este endereço não está autorizado para login.'],
    [
      'auth/popup-closed-by-user',
      'A janela do Google foi fechada antes de concluir. Tente novamente.',
    ],
    [
      'auth/popup-blocked',
      'O navegador bloqueou a janela do Google. Libere os pop-ups e tente novamente.',
    ],
    [
      'auth/account-exists-with-different-credential',
      'Já existe uma conta com este e-mail usando outro método de acesso. Entre com e-mail e senha.',
    ],
  ])('traduz o código %s', (code, expected) => {
    expect(messageFor(code)).toBe(expected)
  })

  it('mostra o código técnico em um erro desconhecido', () => {
    expect(messageFor('auth/codigo-inexistente')).toBe(
      'Falha no acesso (auth/codigo-inexistente).',
    )
  })

  it('devolve a mensagem padrão para valores que não são FirebaseError', () => {
    expect(getAuthErrorMessage('algo deu errado')).toBe(FALLBACK)
    expect(getAuthErrorMessage(null)).toBe(FALLBACK)
    expect(getAuthErrorMessage(undefined)).toBe(FALLBACK)
    expect(getAuthErrorMessage(new Error('falha comum'))).toBe(FALLBACK)
  })
})
