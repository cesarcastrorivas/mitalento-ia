import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/server-auth';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * GET /api/auth/me
 * Returns the full user profile from Firestore (via Admin SDK) for the current session.
 * Used by AuthContext to get the user's role and profile without trusting client-side Firestore reads.
 */
export async function GET() {
    try {
        const serverUser = await getServerUser();
        if (!serverUser) {
            return NextResponse.json(null, { status: 401 });
        }

        const db = getAdminDb();
        const userDoc = await db.collection('users').doc(serverUser.uid).get();

        if (!userDoc.exists) {
            return NextResponse.json(null, { status: 404 });
        }

        return NextResponse.json({ uid: serverUser.uid, ...userDoc.data() });
    } catch {
        return NextResponse.json(null, { status: 500 });
    }
}
