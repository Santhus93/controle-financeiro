import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '../firebase/app'
import { loginWithEmail, logout, reloadUser } from '../services/authService'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** Recarrega o usuário do Firebase e devolve se o e-mail já foi confirmado. */
  refreshUser: () => Promise<boolean>
}

interface SessionState {
  user: User | null
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  // A sessão fica dentro de um objeto para o reload() poder trocar a referência
  // mesmo quando o Firebase devolve o mesmo User (ele é mutado no lugar).
  const [session, setSession] = useState<SessionState>({ user: null })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setSession({ user: currentUser })
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session.user,
      loading,
      login: async (email, password) => {
        await loginWithEmail(email, password)
      },
      logout,
      refreshUser: async () => {
        const refreshed = await reloadUser()

        if (!refreshed) return false

        setSession({ user: refreshed })

        return refreshed.emailVerified
      },
    }),
    [session, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de AuthProvider.')
  }

  return context
}
