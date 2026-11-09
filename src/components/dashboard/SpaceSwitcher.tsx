import { useState } from 'react'
import { Check, ChevronDown, Pencil, Plus } from 'lucide-react'
import { createSpace } from '../../services/spacesService'
import type { ActiveScope, Space } from '../../types/Space'
import { getErrorMessage } from '../../utils/errors'
import { RenameSpaceDialog } from './RenameSpaceDialog'

interface SpaceSwitcherProps {
  uid: string
  spaces: Space[]
  activeScope: ActiveScope
  onScopeChange: (scope: ActiveScope) => void
  onSpacesChange: (spaces: Space[]) => void
  onSpaceRenamed?: (space: Space) => void
  toast: (message: string, type?: 'success' | 'error' | 'info') => void
}

function getRoleLabel(space: Space, uid: string): string {
  const role = space.roles?.[uid] ?? (space.ownerUid === uid ? 'owner' : 'viewer')
  if (role === 'owner') return 'Dono'
  if (role === 'editor') return 'Editor'
  return 'Leitor'
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
  onSpaceRenamed,
  toast,
}: SpaceSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [renamingSpace, setRenamingSpace] = useState<Space | null>(null)

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
            <div
              role="option"
              aria-selected={activeScope.kind === 'personal'}
              tabIndex={0}
              className={`space-switcher-item${activeScope.kind === 'personal' ? ' active' : ''}`}
              onClick={() => handleSelect({ kind: 'personal' })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleSelect({ kind: 'personal' })
                }
              }}
            >
              <div className="space-switcher-item-info">
                <span className="space-switcher-item-name">Pessoal</span>
                <span className="space-switcher-item-sub">Pessoal · só você</span>
              </div>
              <div className="space-switcher-item-actions">
                {activeScope.kind === 'personal' && (
                  <span className="space-switcher-check" aria-hidden="true">
                    <Check size={16} />
                  </span>
                )}
              </div>
            </div>

            {/* Espaços */}
            {spaces.map((space) => {
              const isActive = activeScope.kind === 'space' && activeScope.space.id === space.id
              const isOwner = space.ownerUid === uid || space.roles?.[uid] === 'owner'
              const roleLabel = getRoleLabel(space, uid)

              return (
                <div
                  key={space.id}
                  role="option"
                  aria-selected={isActive}
                  tabIndex={0}
                  className={`space-switcher-item${isActive ? ' active' : ''}`}
                  onClick={() => handleSelect({ kind: 'space', space })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleSelect({ kind: 'space', space })
                    }
                  }}
                >
                  <div className="space-switcher-item-info">
                    <span className="space-switcher-item-name">{space.name}</span>
                    <span className="space-switcher-item-sub">Espaço compartilhado · {roleLabel}</span>
                  </div>
                  <div className="space-switcher-item-actions">
                    {isActive && isOwner && (
                      <button
                        type="button"
                        className="space-switcher-rename-btn"
                        title="Renomear espaço"
                        aria-label="Renomear espaço"
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpen(false)
                          setRenamingSpace(space)
                        }}
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                    {isActive && (
                      <span className="space-switcher-check" aria-hidden="true">
                        <Check size={16} />
                      </span>
                    )}
                  </div>
                </div>
              )
            })}

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
                <Plus size={14} />
                <span>Novo espaço</span>
              </button>
            )}
          </div>
        </>
      )}

      {renamingSpace && (
        <RenameSpaceDialog
          space={renamingSpace}
          onRenamed={(updated) => {
            onSpacesChange(
              spaces
                .map((s) => (s.id === updated.id ? updated : s))
                .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
            )
            onSpaceRenamed?.(updated)
            setRenamingSpace(null)
          }}
          onClose={() => setRenamingSpace(null)}
          toast={toast}
        />
      )}
    </div>
  )
}
