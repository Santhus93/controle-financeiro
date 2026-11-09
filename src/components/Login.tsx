import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, LockKeyhole, ShieldCheck, WalletCards } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { resetPassword, signInWithGoogle, signUp } from '../services/authService'
import { getAuthErrorMessage } from '../utils/authErrors'

type AuthMode = 'login' | 'signup' | 'reset'

const RESET_SUCCESS_MESSAGE =
  'Se este e-mail estiver cadastrado, enviamos um link para criar uma nova senha. Confira a caixa de entrada e o spam.'

const MODE_CONTENT: Record<AuthMode, { title: string; description: string; submit: string; busy: string }> = {
  login: {
    title: 'Entre na sua conta',
    description: 'Use seu e-mail e senha de acesso.',
    submit: 'Entrar',
    busy: 'Entrando...',
  },
  signup: {
    title: 'Crie a sua conta',
    description: 'Leva menos de um minuto para começar a organizar suas faturas.',
    submit: 'Criar conta',
    busy: 'Criando conta...',
  },
  reset: {
    title: 'Recuperar senha',
    description: 'Informe o e-mail da conta e enviaremos um link para criar uma nova senha.',
    submit: 'Enviar link',
    busy: 'Enviando...',
  },
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

export function Login() {
  const { login } = useAuth()
  const [mode, setMode] = useState<AuthMode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const content = MODE_CONTENT[mode]

  const switchMode = (next: AuthMode) => {
    if (next === mode) return

    setMode(next)
    setError('')
    setInfo('')
    setPassword('')
    setConfirmPassword('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setInfo('')

    const trimmedEmail = email.trim()

    if (mode === 'reset') {
      if (!trimmedEmail) {
        setError('Informe o e-mail da conta.')
        return
      }

      setSubmitting(true)

      try {
        await resetPassword(trimmedEmail)
        setInfo(RESET_SUCCESS_MESSAGE)
      } catch (cause) {
        // Não revela se o e-mail existe: usuário não encontrado cai na mesma mensagem.
        if ((cause as { code?: string } | null)?.code === 'auth/user-not-found') {
          setInfo(RESET_SUCCESS_MESSAGE)
        } else {
          setError(getAuthErrorMessage(cause))
        }
      } finally {
        setSubmitting(false)
      }

      return
    }

    if (!trimmedEmail || !password) {
      setError('Preencha o e-mail e a senha.')
      return
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        setError('Informe o seu nome.')
        return
      }
      if (password.length < 6) {
        setError('A senha precisa ter pelo menos 6 caracteres.')
        return
      }
      if (password !== confirmPassword) {
        setError('As senhas não conferem.')
        return
      }
    }

    setSubmitting(true)

    try {
      if (mode === 'signup') {
        await signUp(name, trimmedEmail, password)
      } else {
        await login(trimmedEmail, password)
      }
    } catch (cause) {
      setError(getAuthErrorMessage(cause))
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    setInfo('')
    setSubmitting(true)

    try {
      await signInWithGoogle()
      // Pop-up: o onAuthStateChanged troca a tela. Redirecionamento: a página navega.
    } catch (cause) {
      setError(getAuthErrorMessage(cause))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand-content">
          <div className="login-logo"><WalletCards size={25} /></div>
          <span className="login-eyebrow">MINHA FATURA</span>
          <h1>Os seus gastos organizados em um só lugar.</h1>
          <p>
            Importe a fatura do cartão, acompanhe categorias, orçamento e
            parcelamentos, e veja a evolução mês a mês.
          </p>
          <div className="login-security-note">
            <ShieldCheck size={19} />
            <span>
              O arquivo da fatura é lido no seu navegador. Somente os lançamentos
              ficam salvos, protegidos pelo seu login.
            </span>
          </div>
        </div>
      </section>

      <section className="login-form-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-card-icon"><LockKeyhole size={23} /></div>
          <span className="login-card-eyebrow">ACESSO SEGURO</span>
          <h2>{content.title}</h2>
          <p className="login-card-description">{content.description}</p>

          <div className="login-mode-tabs" role="tablist" aria-label="Forma de acesso">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={mode === 'login' ? 'active' : ''}
              onClick={() => switchMode('login')}
            >
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              className={mode === 'signup' ? 'active' : ''}
              onClick={() => switchMode('signup')}
            >
              Criar conta
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'reset'}
              className={mode === 'reset' ? 'active' : ''}
              onClick={() => switchMode('reset')}
            >
              Esqueci minha senha
            </button>
          </div>

          {mode === 'signup' && (
            <label className="login-field">
              <span>Nome</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Como você quer ser chamado"
                autoComplete="name"
              />
            </label>
          )}

          <label className="login-field">
            <span>E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seuemail@exemplo.com"
              autoComplete="email"
              autoFocus
            />
          </label>

          {mode !== 'reset' && (
            <label className="login-field">
              <span>Senha</span>
              <div className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === 'signup' ? 'Crie uma senha' : 'Digite sua senha'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
          )}

          {mode === 'signup' && (
            <>
              <label className="login-field">
                <span>Confirmar senha</span>
                <div className="password-field">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repita a senha"
                    autoComplete="new-password"
                  />
                </div>
              </label>
              <p className="login-hint">A senha precisa ter pelo menos 6 caracteres.</p>
            </>
          )}

          {error && <div className="login-error" role="alert">{error}</div>}
          {info && <div className="login-info" role="status">{info}</div>}

          <button className="login-submit" type="submit" disabled={submitting}>
            {submitting ? content.busy : content.submit}
          </button>

          {(mode === 'login' || mode === 'signup') && (
            <>
              <div className="login-divider"><span>ou</span></div>
              <button
                type="button"
                className="login-google"
                onClick={() => void handleGoogle()}
                disabled={submitting}
              >
                <GoogleIcon />
                Entrar com Google
              </button>
            </>
          )}

          {mode === 'reset' && (
            <button type="button" className="login-link-button" onClick={() => switchMode('login')}>
              Voltar para o login
            </button>
          )}
        </form>
      </section>
    </main>
  )
}
