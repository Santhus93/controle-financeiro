import { useEffect, useState, type FormEvent } from 'react'
import { Copy, LogOut, Share2, Trash2, UserPlus, X } from 'lucide-react'
import { useUi } from '../../contexts/UiContext'
import { createInvite, deleteInvite, listSpaceInvites } from '../../services/invitesService'
import { changeMemberRole, getSpace, leaveSpace, removeMember } from '../../services/spacesService'
import type { Invite, InviteRole, Space } from '../../types/Space'
import { getErrorMessage } from '../../utils/errors'
import { buildInviteMessage, isValidEmail, normalizeEmail, ROLE_LABELS } from '../../utils/invites'

interface MembersDialogProps {
  space: Space
  uid: string
  userEmail: string
  onClose: () => void
  onSpaceUpdated: (space: Space) => void
  onLeft: (spaceId: string) => void
  toast: (message: string, type?: 'success' | 'error' | 'info') => void
}

function appUrl(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`
}

function without<T>(record: Record<string, T> | undefined, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record ?? {}).filter(([k]) => k !== key))
}

/** Membros do espaço, convites pendentes e convite novo (dono) ou "Sair do espaço" (membro). */
export function MembersDialog({
  space,
  uid,
  userEmail,
  onClose,
  onSpaceUpdated,
  onLeft,
  toast,
}: MembersDialogProps) {
  const { confirm } = useUi()
  const isOwner = space.ownerUid === uid
  const [invites, setInvites] = useState<Invite[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InviteRole>('editor')
  const [busy, setBusy] = useState(false)
  const [lastInvite, setLastInvite] = useState<Invite | null>(null)
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  // Recarrega o espaço (alguém pode ter aceitado um convite) e os convites do dono.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const fresh = await getSpace(space.id)
        if (!cancelled) onSpaceUpdated(fresh)
        if (isOwner) {
          const found = await listSpaceInvites(space.id, uid)
          if (!cancelled) setInvites(found)
        }
      } catch (cause) {
        if (!cancelled) toast(getErrorMessage(cause), 'error')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space.id])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    try {
      await action()
    } catch (cause) {
      toast(getErrorMessage(cause), 'error')
    } finally {
      setBusy(false)
    }
  }

  const messageFor = (invite: Invite) => buildInviteMessage(space.name, invite.email, appUrl())

  const handleCopy = async (invite: Invite) => {
    try {
      await navigator.clipboard.writeText(messageFor(invite))
      toast('Mensagem copiada. Cole no WhatsApp ou no e-mail.')
    } catch {
      toast('Não foi possível copiar. Selecione o texto e copie manualmente.', 'error')
    }
  }

  const handleShare = async (invite: Invite) => {
    try {
      await navigator.share({ title: `Convite para ${space.name}`, text: messageFor(invite) })
    } catch {
      // compartilhamento cancelado pelo usuário
    }
  }

  const handleInvite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = normalizeEmail(email)

    if (!isValidEmail(normalized)) {
      toast('Informe um e-mail válido.', 'error')
      return
    }
    if (normalized === normalizeEmail(userEmail)) {
      toast('Você já faz parte deste espaço.', 'info')
      return
    }
    const alreadyMember = Object.values(space.memberInfo ?? {}).some(
      (info) => normalizeEmail(info.email) === normalized,
    )
    if (alreadyMember) {
      toast('Essa pessoa já é membro do espaço.', 'info')
      return
    }

    void run(async () => {
      const invite = await createInvite(space, uid, userEmail, normalized, role)
      setInvites((current) =>
        [...current.filter((item) => item.id !== invite.id), invite].sort((a, b) =>
          a.email.localeCompare(b.email, 'pt-BR'),
        ),
      )
      setLastInvite(invite)
      setEmail('')
      toast('Convite criado. Agora envie a mensagem para a pessoa.')
    })
  }

  const handleCancelInvite = (invite: Invite) =>
    void run(async () => {
      await deleteInvite(invite.id)
      setInvites((current) => current.filter((item) => item.id !== invite.id))
      if (lastInvite?.id === invite.id) setLastInvite(null)
      toast('Convite cancelado.')
    })

  const handleRoleChange = (memberUid: string, newRole: InviteRole) =>
    void run(async () => {
      await changeMemberRole(space.id, memberUid, newRole)
      onSpaceUpdated({ ...space, roles: { ...space.roles, [memberUid]: newRole } })
      toast('Papel atualizado.')
    })

  const handleRemove = async (memberUid: string, label: string) => {
    const ok = await confirm({
      title: 'Remover membro',
      message: `${label} perde o acesso a "${space.name}". Os lançamentos já feitos continuam no espaço.`,
      confirmLabel: 'Remover',
      danger: true,
    })
    if (!ok) return

    await run(async () => {
      await removeMember(space.id, memberUid)
      onSpaceUpdated({
        ...space,
        memberUids: space.memberUids.filter((item) => item !== memberUid),
        roles: without(space.roles, memberUid),
        memberInfo: without(space.memberInfo, memberUid),
      })
      toast('Membro removido.')
    })
  }

  const handleLeave = async () => {
    const ok = await confirm({
      title: 'Sair do espaço',
      message: `Você deixa de ver os dados de "${space.name}". Para voltar, o dono precisa te convidar de novo.`,
      confirmLabel: 'Sair',
      danger: true,
    })
    if (!ok) return

    await run(async () => {
      await leaveSpace(space.id, uid)
      onLeft(space.id)
      toast(`Você saiu de "${space.name}".`)
    })
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog members-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="members-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="members-head">
          <div>
            <span className="eyebrow">Espaço compartilhado</span>
            <h2 id="members-title">{space.name}</h2>
          </div>
          <button type="button" className="members-close" aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <h3 className="members-section-title">Membros ({space.memberUids.length})</h3>
        <ul className="members-list">
          {space.memberUids.map((memberUid) => {
            const info = space.memberInfo?.[memberUid]
            const isMe = memberUid === uid
            const memberRole = space.roles[memberUid] ?? 'viewer'
            const label = isMe ? `${info?.email ?? userEmail} (você)` : info?.email ?? 'Membro'
            const canManage = isOwner && !isMe && memberRole !== 'owner'

            return (
              <li className="members-row" key={memberUid}>
                <div className="members-info">
                  <strong title={label}>{label}</strong>
                  {info?.name && !isMe && <span>{info.name}</span>}
                </div>
                {canManage ? (
                  <select
                    className="members-role"
                    value={memberRole}
                    disabled={busy}
                    aria-label={`Papel de ${label}`}
                    onChange={(event) => handleRoleChange(memberUid, event.target.value as InviteRole)}
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Leitor</option>
                  </select>
                ) : (
                  <span className="members-role-label">{ROLE_LABELS[memberRole]}</span>
                )}
                {canManage && (
                  <button
                    type="button"
                    className="members-icon-btn danger"
                    aria-label={`Remover ${label}`}
                    title="Remover do espaço"
                    disabled={busy}
                    onClick={() => void handleRemove(memberUid, label)}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>

        {isOwner && (
          <>
            <h3 className="members-section-title">Convidar pessoa</h3>
            <form className="members-form" onSubmit={handleInvite}>
              <input
                type="email"
                className="members-input"
                placeholder="email@exemplo.com"
                value={email}
                disabled={busy}
                autoComplete="off"
                onChange={(event) => setEmail(event.target.value)}
              />
              <select
                className="members-role"
                value={role}
                disabled={busy}
                aria-label="Papel do convidado"
                onChange={(event) => setRole(event.target.value as InviteRole)}
              >
                <option value="editor">Editor</option>
                <option value="viewer">Leitor</option>
              </select>
              <button type="submit" className="button-primary small" disabled={busy || !email.trim()}>
                <UserPlus size={15} /> Convidar
              </button>
            </form>
            <p className="members-hint">
              Editor lança contas, gastos e importa faturas. Leitor só visualiza.
            </p>

            {lastInvite && (
              <div className="members-invite-result">
                <strong>Agora envie o convite para {lastInvite.email}</strong>
                <p>
                  O app não envia e-mail sozinho. Mande a mensagem abaixo pelo WhatsApp ou por e-mail.
                  A pessoa precisa criar a conta com esse mesmo e-mail e confirmá-lo.
                </p>
                <textarea readOnly rows={7} value={messageFor(lastInvite)} />
                <div className="members-actions">
                  <button type="button" className="rules-reapply" onClick={() => void handleCopy(lastInvite)}>
                    <Copy size={14} /> Copiar mensagem
                  </button>
                  {canShare && (
                    <button type="button" className="rules-reapply" onClick={() => void handleShare(lastInvite)}>
                      <Share2 size={14} /> Compartilhar
                    </button>
                  )}
                </div>
              </div>
            )}

            <h3 className="members-section-title">Convites pendentes ({invites.length})</h3>
            {invites.length ? (
              <ul className="members-list">
                {invites.map((invite) => (
                  <li className="members-row" key={invite.id}>
                    <div className="members-info">
                      <strong title={invite.email}>{invite.email}</strong>
                      <span>{ROLE_LABELS[invite.role]} · aguardando aceite</span>
                    </div>
                    <button
                      type="button"
                      className="members-icon-btn"
                      aria-label={`Copiar mensagem para ${invite.email}`}
                      title="Copiar mensagem de convite"
                      onClick={() => void handleCopy(invite)}
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      type="button"
                      className="members-icon-btn danger"
                      aria-label={`Cancelar convite de ${invite.email}`}
                      title="Cancelar convite"
                      disabled={busy}
                      onClick={() => handleCancelInvite(invite)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="members-empty">Nenhum convite pendente.</p>
            )}
          </>
        )}

        {!isOwner && (
          <div className="members-leave">
            <button type="button" className="delete-invoice-button" disabled={busy} onClick={() => void handleLeave()}>
              <LogOut size={15} /> Sair do espaço
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
