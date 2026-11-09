import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { renameSpace } from '../../services/spacesService'
import type { Space } from '../../types/Space'
import { getErrorMessage } from '../../utils/errors'

interface RenameSpaceDialogProps {
  space: Space
  onRenamed: (space: Space) => void
  onClose: () => void
  toast: (message: string, type?: 'success' | 'error' | 'info') => void
}

/** Janela própria (modal) para renomear um espaço. Só o dono vê esse botão. */
export function RenameSpaceDialog({ space, onRenamed, onClose, toast }: RenameSpaceDialogProps) {
  const [name, setName] = useState(space.name)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || saving) return

    setSaving(true)
    try {
      await renameSpace(space.id, name)
      onRenamed({ ...space, name: name.trim() })
      toast(`Espaço renomeado para "${name.trim()}".`)
      onClose()
    } catch (cause) {
      toast(getErrorMessage(cause), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-icon">
          <Pencil size={22} />
        </div>
        <h2>Renomear espaço</h2>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="login-field" style={{ marginBottom: 16 }}>
            <span>Nome</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              autoFocus
              disabled={saving}
            />
          </div>
          <div className="dialog-actions">
            <button type="button" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button
              type="submit"
              className="button-primary"
              disabled={!name.trim() || name.trim() === space.name || saving}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
