import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase/firebase'
import type { Invite, InviteRole, Space } from '../types/Space'
import { buildInviteId, normalizeEmail } from '../utils/invites'
import { getSpace } from './spacesService'

function invitesCollection() {
  return collection(db, 'invites')
}

function inviteFromFirestore(id: string, data: Record<string, unknown>): Invite {
  return {
    id,
    spaceId: String(data.spaceId ?? ''),
    spaceName: String(data.spaceName ?? ''),
    email: String(data.email ?? ''),
    role: (data.role === 'viewer' ? 'viewer' : 'editor') as InviteRole,
    ownerUid: String(data.ownerUid ?? ''),
    invitedByEmail: String(data.invitedByEmail ?? ''),
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
  }
}

function byEmail(a: Invite, b: Invite) {
  return a.email.localeCompare(b.email, 'pt-BR')
}

/** Dono convida um e-mail. Convidar de novo o mesmo e-mail só atualiza o papel. */
export async function createInvite(
  space: Space,
  ownerUid: string,
  ownerEmail: string,
  email: string,
  role: InviteRole,
): Promise<Invite> {
  const normalized = normalizeEmail(email)
  const id = buildInviteId(space.id, normalized)

  await setDoc(doc(invitesCollection(), id), {
    spaceId: space.id,
    spaceName: space.name,
    email: normalized,
    role,
    ownerUid,
    invitedByEmail: normalizeEmail(ownerEmail),
    createdAt: serverTimestamp(),
  })

  return {
    id,
    spaceId: space.id,
    spaceName: space.name,
    email: normalized,
    role,
    ownerUid,
    invitedByEmail: normalizeEmail(ownerEmail),
    createdAt: new Date(),
  }
}

/** Convites pendentes de um espaço (visão do dono). */
export async function listSpaceInvites(spaceId: string, ownerUid: string): Promise<Invite[]> {
  const snapshot = await getDocs(
    query(invitesCollection(), where('spaceId', '==', spaceId), where('ownerUid', '==', ownerUid)),
  )
  return snapshot.docs
    .map((item) => inviteFromFirestore(item.id, item.data() as Record<string, unknown>))
    .sort(byEmail)
}

/** Convites recebidos pelo usuário logado (exige e-mail verificado). */
export async function listMyInvites(email: string): Promise<Invite[]> {
  const snapshot = await getDocs(query(invitesCollection(), where('email', '==', normalizeEmail(email))))
  return snapshot.docs
    .map((item) => inviteFromFirestore(item.id, item.data() as Record<string, unknown>))
    .sort((a, b) => a.spaceName.localeCompare(b.spaceName, 'pt-BR'))
}

/** Dono cancela um convite ou convidado recusa. */
export async function deleteInvite(inviteId: string): Promise<void> {
  await deleteDoc(doc(invitesCollection(), inviteId))
}

/**
 * Convidado aceita: entra no espaço com o papel do convite e apaga o convite,
 * na mesma operação. Devolve o espaço já com o novo membro.
 */
export async function acceptInvite(
  invite: Invite,
  uid: string,
  email: string,
  name?: string | null,
): Promise<Space> {
  const batch = writeBatch(db)

  batch.update(doc(db, 'spaces', invite.spaceId), {
    memberUids: arrayUnion(uid),
    [`roles.${uid}`]: invite.role,
    [`memberInfo.${uid}`]: name?.trim()
      ? { email: normalizeEmail(email), name: name.trim() }
      : { email: normalizeEmail(email) },
  })
  batch.delete(doc(invitesCollection(), invite.id))

  await batch.commit()
  return getSpace(invite.spaceId)
}
