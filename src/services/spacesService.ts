import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  doc,
} from 'firebase/firestore'
import { db } from '../firebase/firebase'
import type { Space } from '../types/Space'

function spaceFromFirestore(id: string, data: Record<string, unknown>): Space {
  return {
    id,
    name: data.name as string,
    ownerUid: data.ownerUid as string,
    memberUids: data.memberUids as string[],
    roles: data.roles as Space['roles'],
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

/** Cria um novo espaço e retorna o objeto criado. */
export async function createSpace(uid: string, name: string): Promise<Space> {
  const data = {
    name: name.trim(),
    ownerUid: uid,
    memberUids: [uid],
    roles: { [uid]: 'owner' as const },
    createdAt: serverTimestamp(),
  }
  const ref = await addDoc(collection(db, 'spaces'), data)
  return {
    id: ref.id,
    name: data.name,
    ownerUid: uid,
    memberUids: [uid],
    roles: { [uid]: 'owner' },
    createdAt: new Date(),
  }
}

/** Renomeia um espaço (apenas o dono pode chamar; regras do Firestore garantem). */
export async function renameSpace(spaceId: string, name: string): Promise<void> {
  await updateDoc(doc(db, 'spaces', spaceId), { name: name.trim() })
}
