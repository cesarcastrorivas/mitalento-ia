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
        const sessionCookie = nextCookies.get('__session')?.value;

        if (!sessionCookie) {
            return null;
        }

        const auth = getAdminAuth();
        const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);

        // Fetch role from Firestore — roles live in the user document, not in Firebase claims
        const db = getAdminDb();
        const userDoc = await db.collection('users').doc(decodedClaims.uid).get();

        if (!userDoc.exists) {
            return null;
        }

        const userData = userDoc.data();

        return {
            uid: decodedClaims.uid,
            email: decodedClaims.email,
            role: userData?.role === 'admin' ? 'admin' : 'student',
        };
    } catch {
        return null;
    }
}
