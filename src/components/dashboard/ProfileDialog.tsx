import { useEffect, useState, type FormEvent } from 'react'
import { LoaderCircle, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useUi } from '../../contexts/UiContext'
import { updateDisplayName } from '../../services/authService'
import { getErrorMessage } from '../../utils/errors'
import { DISPLAY_NAME_MAX_LENGTH, validateDisplayName } from '../../utils/displayName'

interface ProfileDialogProps {
  onClose: () => void
}

/**
 * Pequeno diálogo de perfil.
 * O nome fica no `displayName` do Firebase Auth e é a fonte da autoria
 * dos lançamentos em espaços compartilhados — não há coleção de perfil.
 */
export function ProfileDialog({ onClose }: ProfileDialogProps) {
  const { user, refreshUser } = useAuth()
  const { toast } = useUi()
  const [name, setName] = useState(user?.displayName ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!user) return null

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const validation = validateDisplayName(name)

    if (!validation.ok) {
      setError(validation.error)
      return
    }

    setSaving(true)

    try {
      await updateDisplayName(validation.name)
      await refreshUser()
      toast('Nome de exibição atualizado.', 'success')
      onClose()
    } catch (cause) {
      setError(getErrorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="profile-dialog-backdrop" role="presentation" onClick={onClose}>
      <form
        className="profile-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-dialog-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <header>
          <div>
            <h2 id="profile-dialog-title">Meu perfil</h2>
            <p>Seu nome é usado na autoria dos lançamentos em espaços compartilhados.</p>
          </div>
          <button
            type="button"
            className="profile-dialog-close"
            aria-label="Fechar"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>

        <label className="profile-field">
          <span>Nome de exibição</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Como você quer ser chamado"
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            autoComplete="name"
            autoFocus
          />
        </label>
        <p className="profile-hint">
          Este é o nome que aparece em espaços compartilhados e na autoria dos lançamentos.
        </p>

        <label className="profile-field">
          <span>E-mail</span>
          <input type="email" value={user.email ?? ''} readOnly disabled />
        </label>

        {error && (
          <div className="profile-error" role="alert">
            {error}
          </div>
        )}

        <div className="profile-dialog-actions">
          <button type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? <LoaderCircle className="spin" size={14} /> : null}
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  )
}
