import { useState } from 'react'
import { MailWarning } from 'lucide-react'
import type { ToastType } from '../../contexts/UiContext'
import { resendVerification } from '../../services/authService'
import { getErrorMessage } from '../../utils/errors'

interface EmailVerificationBannerProps {
  email: string | null
  /** Recarrega o usuário e devolve se o e-mail já foi confirmado. */
  onRefresh: () => Promise<boolean>
  toast: (message: string, type?: ToastType) => void
}

/**
 * Faixa discreta para quem entrou com e-mail e senha e ainda não confirmou.
 * O usuário continua usando o espaço pessoal normalmente; a confirmação será
 * exigida apenas para aceitar convites (V5.2).
 */
export function EmailVerificationBanner({
  email,
  onRefresh,
  toast,
}: EmailVerificationBannerProps) {
  const [sending, setSending] = useState(false)
  const [checking, setChecking] = useState(false)
  const [info, setInfo] = useState('')

  const handleResend = async () => {
    setSending(true)
    setInfo('')

    try {
      await resendVerification()
      toast('Link de confirmação reenviado. Confira a caixa de entrada e o spam.', 'success')
    } catch (cause) {
      toast(getErrorMessage(cause), 'error')
    } finally {
      setSending(false)
    }
  }

  const handleCheck = async () => {
    setChecking(true)
    setInfo('')

    try {
      const verified = await onRefresh()

      if (verified) {
        toast('E-mail confirmado. Tudo pronto!', 'success')
      } else {
        setInfo('Ainda não identificamos a confirmação. Abra o link enviado e tente de novo.')
      }
    } catch (cause) {
      toast(getErrorMessage(cause), 'error')
    } finally {
      setChecking(false)
    }
  }

  const busy = sending || checking

  return (
    <section className="email-verify-banner" aria-live="polite">
      <MailWarning size={18} />

      <div className="email-verify-text">
        <strong>Confirme seu e-mail</strong>
        <span>
          Enviamos um link para {email ?? 'o seu e-mail'}. Confirmar agora garante o acesso a
          convites e espaços compartilhados.
        </span>
        {info && <em>{info}</em>}
      </div>

      <div className="email-verify-actions">
        <button type="button" onClick={() => void handleResend()} disabled={busy}>
          {sending ? 'Enviando...' : 'Reenviar link'}
        </button>
        <button type="button" onClick={() => void handleCheck()} disabled={busy}>
          {checking ? 'Verificando...' : 'Já confirmei'}
        </button>
      </div>
    </section>
  )
}
