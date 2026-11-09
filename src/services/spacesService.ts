import {
  addDoc,
  arrayRemove,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase/firebase'
import type { InviteRole, MemberInfo, Space } from '../types/Space'
import { normalizeEmail } from '../utils/invites'

export function spaceFromFirestore(id: string, data: Record<string, unknown>): Space {
  return {
    id,
    name: data.name as string,
    ownerUid: data.ownerUid as string,
    memberUids: (data.memberUids as string[]) ?? [],
    roles: (data.roles as Space['roles']) ?? {},
    memberInfo: (data.memberInfo as Record<string, MemberInfo> | undefined) ?? {},
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate()
        : new Date(data.createdAt as string),
  }
}

/** Lista todos os espaços de que o usuário é membro, ordenados por nome. */
export async function listMySpaces(uid: string): Promise<Space[]> {
  const q = query(
    collection(db, 'spaces'),
    where('memberUids', 'array-contains', uid),
    orderBy('name'),
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((item) => spaceFromFirestore(item.id, item.data() as Record<string, unknown>))
}

/** Lê um espaço (só membros conseguem). */
export async function getSpace(spaceId: string): Promise<Space> {
  const snapshot = await getDoc(doc(db, 'spaces', spaceId))
  if (!snapshot.exists()) throw new Error('Espaço não encontrado ou sem acesso.')
  return spaceFromFirestore(snapshot.id, snapshot.data() as Record<string, unknown>)
}

/** Cria um novo espaço e retorna o objeto criado. */
export async function createSpace(uid: string, name: string, email?: string | null): Promise<Space> {
  const memberInfo: Record<string, MemberInfo> = email ? { [uid]: { email: normalizeEmail(email) } } : {}
  const data = {
    name: name.trim(),
    ownerUid: uid,
    memberUids: [uid],
    roles: { [uid]: 'owner' as const },
    memberInfo,
    createdAt: serverTimestamp(),
  }
  const ref = await addDoc(collection(db, 'spaces'), data)
  return {
    id: ref.id,
    name: data.name,
    ownerUid: uid,
    memberUids: [uid],
    roles: { [uid]: 'owner' },
    memberInfo,
    createdAt: new Date(),
  }
}

/** Renomeia um espaço (apenas o dono; as regras do Firestore garantem). */
export async function renameSpace(spaceId: string, name: string): Promise<void> {
  await updateDoc(doc(db, 'spaces', spaceId), { name: name.trim() })
}

/** Dono troca o papel de um membro. */
export async function changeMemberRole(spaceId: string, memberUid: string, role: InviteRole): Promise<void> {
  await updateDoc(doc(db, 'spaces', spaceId), { [`roles.${memberUid}`]: role })
}

function removalUpdate(memberUid: string) {
  return {
    memberUids: arrayRemove(memberUid),
    [`roles.${memberUid}`]: deleteField(),
    [`memberInfo.${memberUid}`]: deleteField(),
  }
}

/** Dono remove um membro. */
export async function removeMember(spaceId: string, memberUid: string): Promise<void> {
  await updateDoc(doc(db, 'spaces', spaceId), removalUpdate(memberUid))
}

/** Membro (não dono) sai do espaço. */
export async function leaveSpace(spaceId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'spaces', spaceId), removalUpdate(uid))
}
