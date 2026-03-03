import { getAdminAuth, getAdminDb } from './firebase-admin';
import { cookies } from 'next/headers';

export interface ServerUser {
    uid: string;
    email: string | undefined;
    role: 'admin' | 'student';
}

export async function getServerUser(): Promise<ServerUser | null> {
    try {
        const nextCookies = await cookies();
        const idToken = nextCookies.get('__session')?.value;

        if (!idToken) {
            return null;
        }

        const auth = getAdminAuth();
        // verifyIdToken usa verificación por clave pública — no necesita permisos IAM especiales
        const decodedToken = await auth.verifyIdToken(idToken);

        const db = getAdminDb();
        const userDoc = await db.collection('users').doc(decodedToken.uid).get();

        if (!userDoc.exists) {
            return null;
        }

        const userData = userDoc.data();

        return {
            uid: decodedToken.uid,
            email: decodedToken.email,
            role: userData?.role === 'admin' ? 'admin' : 'student',
        };
    } catch {
        return null;
    }
}
