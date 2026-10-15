import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, LockKeyhole, ShieldCheck, WalletCards } from 'lucide-react'
import { FirebaseError } from 'firebase/app'
import { useAuth } from '../contexts/AuthContext'

function getLoginError(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    return 'Não foi possível entrar. Tente novamente.'
  }

  switch (error.code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'E-mail ou senha incorretos.'
    case 'auth/invalid-email':
      return 'Informe um e-mail válido.'
    case 'auth/too-many-requests':
      return 'Muitas tentativas de acesso. Aguarde um pouco e tente novamente.'
    case 'auth/network-request-failed':
      return 'Não foi possível conectar ao Firebase. Verifique sua internet.'
    case 'auth/user-disabled':
      return 'Este usuário foi desativado no Firebase Authentication.'
    default:
      return `Falha no login (${error.code}).`
  }
}

export function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (!email.trim() || !password) {
      setError('Preencha o e-mail e a senha.')
      return
    }

    setSubmitting(true)

    try {
      await login(email, password)
    } catch (cause) {
      setError(getLoginError(cause))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand-content">
          <div className="login-logo"><WalletCards size={25} /></div>
          <span className="login-eyebrow">CONTROLE FINANCEIRO</span>
          <h1>Os seus gastos organizados em um só lugar.</h1>
          <p>
            Importe a fatura do Nubank, categorize os lançamentos e acompanhe seus
            parcelamentos com os dados protegidos pelo seu login.
          </p>
          <div className="login-security-note">
            <ShieldCheck size={19} />
            <span>O CSV é processado no navegador. Somente os dados estruturados serão salvos.</span>
          </div>
        </div>
      </section>

      <section className="login-form-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-card-icon"><LockKeyhole size={23} /></div>
          <span className="login-card-eyebrow">ACESSO SEGURO</span>
          <h2>Entre na sua conta</h2>
          <p className="login-card-description">
            Use o usuário criado no Firebase Authentication.
          </p>

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

          <label className="login-field">
            <span>Senha</span>
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Digite sua senha"
                autoComplete="current-password"
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

          {error && <div className="login-error" role="alert">{error}</div>}

          <button className="login-submit" type="submit" disabled={submitting}>
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  )
}
