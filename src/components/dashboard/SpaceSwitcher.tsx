import { useState } from 'react'
import { ChevronDown, Layers, Plus, User } from 'lucide-react'
import { createSpace } from '../../services/spacesService'
import type { ActiveScope, Space } from '../../types/Space'
import { getErrorMessage } from '../../utils/errors'

interface SpaceSwitcherProps {
  uid: string
  spaces: Space[]
  activeScope: ActiveScope
  onScopeChange: (scope: ActiveScope) => void
  onSpacesChange: (spaces: Space[]) => void
  toast: (message: string, type?: 'success' | 'error' | 'info') => void
}

/**
 * Seletor de escopo: "Pessoal", espaços do usuário e "+ Novo espaço".
 * Aparece ao lado do e-mail no cabeçalho.
 */
export function SpaceSwitcher({
  uid,
  spaces,
  activeScope,
  onScopeChange,
  onSpacesChange,
  toast,
}: SpaceSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  const activeLabel =
    activeScope.kind === 'personal' ? 'Pessoal' : activeScope.space.name

  const handleSelect = (scope: ActiveScope) => {
    setOpen(false)
    onScopeChange(scope)
  }

  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || saving) return

    setSaving(true)
    try {
      const space = await createSpace(uid, newName)
      onSpacesChange([...spaces, space].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
      onScopeChange({ kind: 'space', space })
      setCreating(false)
      setNewName('')
      setOpen(false)
      toast(`Espaço "${space.name}" criado.`)
    } catch (cause) {
      toast(getErrorMessage(cause), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-switcher">
      <button
        type="button"
        className="space-switcher-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Trocar espaço"
      >
        {activeScope.kind === 'personal' ? (
          <User size={13} />
        ) : (
          <Layers size={13} />
        )}
        <span className="space-switcher-label">{activeLabel}</span>
        <ChevronDown size={12} className={open ? 'space-switcher-chevron open' : 'space-switcher-chevron'} />
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div
            className="space-switcher-backdrop"
            onClick={() => { setOpen(false); setCreating(false) }}
            aria-hidden
          />
          <div className="space-switcher-menu" role="listbox" aria-label="Selecionar espaço">
            {/* Pessoal */}
            <button
              type="button"
              role="option"
              aria-selected={activeScope.kind === 'personal'}
              className={`space-switcher-item${activeScope.kind === 'personal' ? ' active' : ''}`}
              onClick={() => handleSelect({ kind: 'personal' })}
            >
              <User size={13} />
              Pessoal
            </button>

            {/* Espaços */}
            {spaces.map((space) => (
              <button
                key={space.id}
                type="button"
                role="option"
                aria-selected={activeScope.kind === 'space' && activeScope.space.id === space.id}
                className={`space-switcher-item${
                  activeScope.kind === 'space' && activeScope.space.id === space.id ? ' active' : ''
                }`}
                onClick={() => handleSelect({ kind: 'space', space })}
              >
                <Layers size={13} />
                {space.name}
              </button>
            ))}

            <div className="space-switcher-divider" />

            {/* Novo espaço */}
            {creating ? (
              <form className="space-switcher-create" onSubmit={(e) => void handleCreateSpace(e)}>
                <input
                  type="text"
                  className="space-switcher-input"
                  placeholder="Nome do espaço"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                  maxLength={60}
                  disabled={saving}
                />
                <div className="space-switcher-create-actions">
                  <button
                    type="submit"
                    className="space-switcher-create-btn"
                    disabled={!newName.trim() || saving}
                  >
                    {saving ? 'Criando…' : 'Criar'}
                  </button>
                  <button
                    type="button"
                    className="space-switcher-cancel-btn"
                    onClick={() => { setCreating(false); setNewName('') }}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className="space-switcher-item space-switcher-new"
                onClick={() => setCreating(true)}
              >
                <Plus size={13} />
                Novo espaço
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
