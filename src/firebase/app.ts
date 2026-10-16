import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

/**
 * Inicialização do Firebase + Authentication.
 * Fica separado do Firestore para a tela de login carregar mais rápido:
 * o Firestore só é baixado depois que o usuário entra.
 */
const requiredEnvironmentVariables = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const

const missingEnvironmentVariables = requiredEnvironmentVariables.filter(
  (variableName) => !import.meta.env[variableName],
)

if (missingEnvironmentVariables.length > 0) {
  throw new Error(
    `Configuração Firebase incompleta. Variáveis ausentes: ${missingEnvironmentVariables.join(', ')}`,
  )
}

export const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

export const auth = getAuth(app)
