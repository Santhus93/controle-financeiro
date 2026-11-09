import { useEffect, useState, type FormEvent } from 'react'
import { Check, ChevronDown, Mail, Pencil, Plus, Users } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { acceptInvite, deleteInvite, listMyInvites } from '../../services/invitesService'
import { createSpace } from '../../services/spacesService'
import type { ActiveScope, Invite, Space } from '../../types/Space'
import { getErrorMessage } from '../../utils/errors'
import { ROLE_LABELS } from '../../utils/invites'
import { MembersDialog } from './MembersDialog'
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
  return ROLE_LABELS[role]
}

function sortSpaces(list: Space[]): Space[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

/**
 * Seletor de escopo: convites pendentes, "Pessoal", espaços do usuário e "+ Novo espaço".
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
  const { user } = useAuth()
  const userEmail = user?.email ?? ''
  const verified = Boolean(user?.emailVerified)

  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [renamingSpace, setRenamingSpace] = useState<Space | null>(null)
  const [membersSpace, setMembersSpace] = useState<Space | null>(null)
  const [invites, setInvites] = useState<Invite[]>([])
  const [busyInviteId, setBusyInviteId] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  // Convites recebidos: só para e-mail verificado (as regras do Firestore exigem).
  useEffect(() => {
    if (!user || !verified || !userEmail) return
    let cancelled = false

    const load = async () => {
      try {
        // Atualiza o token para refletir a verificação de e-mail recém-feita.
        await user.getIdToken(true)
        const found = await listMyInvites(userEmail)
        if (!cancelled) setInvites(found)
      } catch {
        // Convites são opcionais: falha aqui não deve atrapalhar o app.
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user, verified, userEmail, reloadKey])

  const activeLabel = activeScope.kind === 'personal' ? 'Pessoal' : activeScope.space.name
  const pendingCount = verified ? invites.length : 0

  const toggleMenu = () => {
    if (!open) setReloadKey((key) => key + 1)
    setOpen(!open)
    setCreating(false)
  }

  const handleSelect = (scope: ActiveScope) => {
    setOpen(false)
    onScopeChange(scope)
  }

  const handleCreateSpace = async (event: FormEvent) => {
    event.preventDefault()
    if (!newName.trim() || saving) return

    setSaving(true)
    try {
      const space = await createSpace(uid, newName, userEmail)
      onSpacesChange(sortSpaces([...spaces, space]))
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

  const handleAccept = async (invite: Invite) => {
    if (!user || busyInviteId) return
    setBusyInviteId(invite.id)
    try {
      const space = await acceptInvite(invite, uid, userEmail, user.displayName)
      setInvites((current) => current.filter((item) => item.id !== invite.id))
      onSpacesChange(sortSpaces([...spaces.filter((item) => item.id !== space.id), space]))
      onScopeChange({ kind: 'space', space })
      setOpen(false)
      toast(`Você entrou no espaço "${space.name}".`)
    } catch (cause) {
      toast(getErrorMessage(cause), 'error')
    } finally {
      setBusyInviteId('')
    }
  }

  const handleDecline = async (invite: Invite) => {
    if (busyInviteId) return
    setBusyInviteId(invite.id)
    try {
      await deleteInvite(invite.id)
      setInvites((current) => current.filter((item) => item.id !== invite.id))
      toast('Convite recusado.', 'info')
    } catch (cause) {
      toast(getErrorMessage(cause), 'error')
    } finally {
      setBusyInviteId('')
    }
  }

  const handleSpaceUpdated = (updated: Space) => {
    onSpacesChange(sortSpaces(spaces.map((item) => (item.id === updated.id ? updated : item))))
    onSpaceRenamed?.(updated)
    setMembersSpace(updated)
  }

  const handleLeft = (spaceId: string) => {
    onSpacesChange(spaces.filter((item) => item.id !== spaceId))
    setMembersSpace(null)
    onScopeChange({ kind: 'personal' })
  }

  return (
    <div className="space-switcher">
      <button
        type="button"
        className="space-switcher-trigger"
        onClick={toggleMenu}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Trocar espaço"
      >
        <span className="space-switcher-label">{activeLabel}</span>
        {pendingCount > 0 && (
          <span className="space-switcher-badge" aria-label={`${pendingCount} convite(s) pendente(s)`}>
            {pendingCount}
          </span>
        )}
        <ChevronDown size={12} className={open ? 'space-switcher-chevron open' : 'space-switcher-chevron'} />
      </button>

      {open && (
        <>
          <div
            className="space-switcher-backdrop"
            onClick={() => {
              setOpen(false)
              setCreating(false)
            }}
            aria-hidden
          />
          <div className="space-switcher-menu" role="listbox" aria-label="Selecionar espaço">
            {/* Convites pendentes */}
            {pendingCount > 0 && (
              <>
                <div className="space-switcher-section-title">Convites</div>
                {invites.map((invite) => (
                  <div className="space-switcher-invite" key={invite.id}>
                    <div className="space-switcher-item-info">
                      <span className="space-switcher-item-name">
                        <Mail size={13} /> {invite.spaceName}
                      </span>
                      <span className="space-switcher-item-sub">
                        {ROLE_LABELS[invite.role]} · convite de {invite.invitedByEmail}
                      </span>
                    </div>
                    <div className="space-switcher-invite-actions">
                      <button
                        type="button"
                        className="space-switcher-create-btn"
                        disabled={Boolean(busyInviteId)}
                        onClick={() => void handleAccept(invite)}
                      >
                        {busyInviteId === invite.id ? 'Entrando…' : 'Aceitar'}
                      </button>
                      <button
                        type="button"
                        className="space-switcher-cancel-btn"
                        disabled={Boolean(busyInviteId)}
                        onClick={() => void handleDecline(invite)}
                      >
                        Recusar
                      </button>
                    </div>
                  </div>
                ))}
                <div className="space-switcher-divider" />
              </>
            )}

            {!verified && (
              <div className="space-switcher-note">
                Confirme seu e-mail para receber convites de espaços compartilhados.
              </div>
            )}

            {/* Pessoal */}
            <div
              role="option"
              aria-selected={activeScope.kind === 'personal'}
              tabIndex={0}
              className={`space-switcher-item${activeScope.kind === 'personal' ? ' active' : ''}`}
              onClick={() => handleSelect({ kind: 'personal' })}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
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
              const isOwner = space.ownerUid === uid
              const roleLabel = getRoleLabel(space, uid)
              const memberCount = space.memberUids.length

              return (
                <div
                  key={space.id}
                  role="option"
                  aria-selected={isActive}
                  tabIndex={0}
                  className={`space-switcher-item${isActive ? ' active' : ''}`}
                  onClick={() => handleSelect({ kind: 'space', space })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      handleSelect({ kind: 'space', space })
                    }
                  }}
                >
                  <div className="space-switcher-item-info">
                    <span className="space-switcher-item-name">{space.name}</span>
                    <span className="space-switcher-item-sub">
                      {roleLabel} · {memberCount} {memberCount === 1 ? 'pessoa' : 'pessoas'}
                    </span>
                  </div>
                  <div className="space-switcher-item-actions">
                    {isActive && (
                      <button
                        type="button"
                        className="space-switcher-rename-btn"
                        title="Membros e convites"
                        aria-label="Membros e convites"
                        onClick={(event) => {
                          event.stopPropagation()
                          setOpen(false)
                          setMembersSpace(space)
                        }}
                      >
                        <Users size={13} />
                      </button>
                    )}
                    {isActive && isOwner && (
                      <button
                        type="button"
                        className="space-switcher-rename-btn"
                        title="Renomear espaço"
                        aria-label="Renomear espaço"
                        onClick={(event) => {
                          event.stopPropagation()
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
              <form className="space-switcher-create" onSubmit={(event) => void handleCreateSpace(event)}>
                <input
                  type="text"
                  className="space-switcher-input"
                  placeholder="Nome do espaço"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  autoFocus
                  maxLength={60}
                  disabled={saving}
                />
                <div className="space-switcher-create-actions">
                  <button type="submit" className="space-switcher-create-btn" disabled={!newName.trim() || saving}>
                    {saving ? 'Criando…' : 'Criar'}
                  </button>
                  <button
                    type="button"
                    className="space-switcher-cancel-btn"
                    onClick={() => {
                      setCreating(false)
                      setNewName('')
                    }}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <button type="button" className="space-switcher-item space-switcher-new" onClick={() => setCreating(true)}>
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
            onSpacesChange(sortSpaces(spaces.map((item) => (item.id === updated.id ? updated : item))))
            onSpaceRenamed?.(updated)
            setRenamingSpace(null)
          }}
          onClose={() => setRenamingSpace(null)}
          toast={toast}
        />
      )}

      {membersSpace && user && (
        <MembersDialog
          space={membersSpace}
          uid={uid}
          userEmail={userEmail}
          onClose={() => setMembersSpace(null)}
          onSpaceUpdated={handleSpaceUpdated}
          onLeft={handleLeft}
          toast={toast}
        />
      )}
    </div>
  )
}
