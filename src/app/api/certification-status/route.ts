import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

export async function GET(req: NextRequest) {
    try {
        const userId = req.nextUrl.searchParams.get('userId');
        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        // Get user document
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userData = userDoc.data();
        const certificationLevel = userData.certificationLevel || 'none';
        const attitudinalStatus = userData.attitudinalStatus || 'pending';

        // Get quiz sessions for this user
        const sessionsQuery = query(
            collection(db, 'quiz_sessions'),
            where('userId', '==', userId)
        );
        const sessionsSnap = await getDocs(sessionsQuery);
        const sessions = sessionsSnap.docs.map(d => d.data());

        // Calculate best scores per module (grouped by day/course if needed)
        const progress = userData.progress || {};

        // Count passed modules
        const passedModules = Object.values(progress).filter((p: any) => p?.completed).length;

        // Average score across all passed sessions
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
