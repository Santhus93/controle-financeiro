import { FirebaseError } from 'firebase/app'

const FALLBACK = 'Não foi possível concluir. Tente novamente.'

/**
 * Mensagem amigável para os erros de autenticação do Firebase.
 * O código técnico não aparece para o usuário, exceto no caso desconhecido,
 * que ajuda a identificar problemas ainda não mapeados.
 */
export function getAuthErrorMessage(error: unknown): string {
  if (!(error instanceof FirebaseError)) return FALLBACK

  switch (error.code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'E-mail ou senha incorretos.'
    case 'auth/invalid-email':
      return 'Informe um e-mail válido.'
    case 'auth/missing-password':
      return 'Informe a senha.'
    case 'auth/weak-password':
      return 'A senha precisa ter pelo menos 6 caracteres.'
    case 'auth/email-already-in-use':
      return 'Este e-mail já está cadastrado. Entre com a sua senha ou recupere o acesso.'
    case 'auth/too-many-requests':
      return 'Muitas tentativas de acesso. Aguarde um pouco e tente novamente.'
    case 'auth/network-request-failed':
      return 'Sem conexão com o servidor. Verifique sua internet.'
    case 'auth/user-disabled':
      return 'Este acesso foi desativado.'
    case 'auth/unauthorized-domain':
      return 'Este endereço não está autorizado para login.'
    case 'auth/popup-closed-by-user':
      return 'A janela do Google foi fechada antes de concluir. Tente novamente.'
    case 'auth/popup-blocked':
      return 'O navegador bloqueou a janela do Google. Libere os pop-ups e tente novamente.'
    case 'auth/account-exists-with-different-credential':
      return 'Já existe uma conta com este e-mail usando outro método de acesso. Entre com e-mail e senha.'
    default:
      return `Falha no acesso (${error.code}).`
  }
}
