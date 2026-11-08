import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'

/**
 * Interface do app:
 * - toast(): avisos que somem sozinhos (substituem a faixa de mensagens);
 * - confirm(): janela de confirmação própria (substitui o window.confirm do navegador);
 * - tema claro/escuro, salvo no navegador.
 */

export type ToastType = 'success' | 'error' | 'info'
export type Theme = 'light' | 'dark'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface UiContextValue {
  toast: (message: string, type?: ToastType) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
  theme: Theme
  toggleTheme: () => void
}

const THEME_KEY = 'controle-financeiro:theme'
const THEME_COLORS: Record<Theme, string> = { light: '#4c1d75', dark: '#0f0b17' }

export function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // localStorage indisponível: segue o sistema
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
}

const UiContext = createContext<UiContextValue | undefined>(undefined)

const TOAST_ICONS = { success: CheckCircle2, error: XCircle, info: Info }

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [dialog, setDialog] = useState<ConfirmOptions | null>(null)
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const resolver = useRef<((value: boolean) => void) | null>(null)
  const nextId = useRef(1)

  useEffect(() => {
    applyTheme(theme)
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // sem persistência, o tema vale só para esta sessão
    }
  }, [theme])

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, type: ToastType = 'success') => {
      const id = nextId.current++
      setToasts((current) => [...current.slice(-2), { id, message, type }])
      window.setTimeout(() => dismiss(id), type === 'error' ? 7000 : 4500)
    },
    [dismiss],
  )

  const confirm = useCallback((options: ConfirmOptions) => {
    resolver.current?.(false)
    setDialog(options)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const closeDialog = useCallback((result: boolean) => {
    resolver.current?.(result)
    resolver.current = null
    setDialog(null)
  }, [])

  useEffect(() => {
    if (!dialog) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDialog(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog, closeDialog])

  const value = useMemo<UiContextValue>(
    () => ({
      toast,
      confirm,
      theme,
      toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
    }),
    [toast, confirm, theme],
  )

  return (
    <UiContext.Provider value={value}>
      {children}

      <div className="toast-stack" aria-live="polite">
        {toasts.map((item) => {
          const Icon = TOAST_ICONS[item.type]
          return (
            <div className={`toast ${item.type}`} key={item.id} role="status">
              <Icon size={18} />
              <span>{item.message}</span>
              <button type="button" aria-label="Fechar aviso" onClick={() => dismiss(item.id)}>
                <X size={15} />
              </button>
            </div>
          )
        })}
      </div>

      {dialog && (
        <div className="dialog-overlay" onClick={() => closeDialog(false)}>
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={`dialog-icon ${dialog.danger ? 'danger' : ''}`}>
              {dialog.danger ? <AlertTriangle size={22} /> : <Info size={22} />}
            </div>
            <h2 id="dialog-title">{dialog.title}</h2>
            {dialog.message && <p>{dialog.message}</p>}
            <div className="dialog-actions">
              <button type="button" className="dialog-cancel" onClick={() => closeDialog(false)}>
                {dialog.cancelLabel ?? 'Cancelar'}
              </button>
              <button
                type="button"
                className={`dialog-confirm ${dialog.danger ? 'danger' : ''}`}
                autoFocus
                onClick={() => closeDialog(true)}
              >
                {dialog.confirmLabel ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </UiContext.Provider>
  )
}

export function useUi(): UiContextValue {
  const context = useContext(UiContext)
  if (!context) throw new Error('useUi deve ser utilizado dentro de UiProvider.')
  return context
}
