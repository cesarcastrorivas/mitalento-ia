import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getServerUser } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
    try {
        const user = await getServerUser();
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const userId = req.nextUrl.searchParams.get('userId');
        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        // Students can only query their own status
        if (user.role !== 'admin' && userId !== user.uid) {
            return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
        }

        const db = getAdminDb();

        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
        }

        const userData = userDoc.data()!;
        const certificationLevel = userData.certificationLevel || 'none';
        const attitudinalStatus = userData.attitudinalStatus || 'pending';

        const sessionsSnap = await db.collection('quiz_sessions')
            .where('userId', '==', userId)
            .get();

        const sessions = sessionsSnap.docs.map((d: any) => d.data());

        const progress = userData.progress || {};
        const passedModules = Object.values(progress).filter((p: any) => p?.completed).length;

        const passedSessions = sessions.filter((s: any) => s.passed);
        const averageScore = passedSessions.length > 0
            ? Math.round(passedSessions.reduce((sum: number, s: any) => sum + s.score, 0) / passedSessions.length)
            : 0;

        return NextResponse.json({
            certificationLevel,
            attitudinalStatus,
            passedModules,
            totalSessions: sessions.length,
            averageScore,
            canAccessDay1: true,
            canAccessDay2: certificationLevel !== 'none',
            canAccessDay3: certificationLevel === 'professional' || certificationLevel === 'elite',
        });

    } catch (error) {
        console.error('Error in certification-status:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
