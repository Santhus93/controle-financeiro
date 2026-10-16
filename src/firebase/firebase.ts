import { getFirestore } from 'firebase/firestore'
import { app, auth } from './app'

// Mantém os mesmos exports de antes: os serviços continuam importando { db } daqui.
export { auth }
export const db = getFirestore(app)
