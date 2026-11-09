import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { auth } from '../firebase/app'

// Idioma dos e-mails enviados pelo Firebase (confirmação e redefinição de senha).
auth.languageCode = 'pt-BR'

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export async function loginWithEmail(email: string, password: string) {
  await setPersistence(auth, browserLocalPersistence)
  return signInWithEmailAndPassword(auth, email.trim(), password)
}

/**
 * Cria a conta com e-mail e senha, grava o nome no perfil e envia o e-mail
 * de confirmação. O Firebase já deixa o usuário autenticado nesse momento.
 */
export async function signUp(name: string, email: string, password: string) {
  await setPersistence(auth, browserLocalPersistence)

  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
  const displayName = name.trim()

  if (displayName) {
    await updateProfile(credential.user, { displayName })
  }

  await sendEmailVerification(credential.user)

  return credential
}

export function resetPassword(email: string) {
  return sendPasswordResetEmail(auth, email.trim())
}

/** O app instalado (PWA) e alguns navegadores móveis não aceitam pop-up. */
function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false

  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean }

  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    navigatorWithStandalone.standalone === true
  )
}

function shouldFallbackToRedirect(cause: unknown): boolean {
  const code = (cause as { code?: string } | null)?.code
  return (
    code === 'auth/popup-blocked' ||
    code === 'auth/operation-not-supported-in-this-environment'
  )
}

/**
 * Login com Google. Usa pop-up no navegador comum e redirecionamento quando o
 * app está instalado como PWA ou quando o navegador bloqueia a janela.
 */
export async function signInWithGoogle() {
  await setPersistence(auth, browserLocalPersistence)

  if (isStandaloneApp()) {
    return signInWithRedirect(auth, googleProvider)
  }

  try {
    return await signInWithPopup(auth, googleProvider)
  } catch (cause) {
    if (shouldFallbackToRedirect(cause)) {
      return signInWithRedirect(auth, googleProvider)
    }

    throw cause
  }
}

/** Reenvia o e-mail de confirmação para o usuário autenticado. */
export async function resendVerification() {
  const currentUser = auth.currentUser

  if (!currentUser) throw new Error('Sessão expirada. Entre novamente.')

  await sendEmailVerification(currentUser)
}

/** Recarrega o usuário do Firebase e devolve a versão atualizada. */
export async function reloadUser(): Promise<User | null> {
  const currentUser = auth.currentUser

  if (!currentUser) return null

  await currentUser.reload()

  return auth.currentUser
}

export function logout() {
  return signOut(auth)
}
