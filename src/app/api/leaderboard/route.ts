import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/server-auth';
import { getAdminDb } from '@/lib/firebase-admin';

export interface LeaderboardEntry {
    uid: string;
    displayName: string;
    photoURL?: string;
    totalScore: number;
    passedModules: number;
    certificationLevel: string;
}

/**
 * GET /api/leaderboard
 *
 * Computes the top-20 leaderboard server-side using Firebase Admin SDK.
 * Benefits vs. client-side Firestore queries:
 *  - Bypasses Firestore security rules (admin SDK) — doesn't expose raw session data.
 *  - Returns only the minimum fields needed for the UI.
 *  - Response is cached for 60 seconds to reduce Firestore reads on repeated loads.
 */
export async function GET() {
    const user = await getServerUser();
    if (!user) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const db = getAdminDb();

        // Only consider sessions from the last 90 days to bound reads & cost
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        // Fetch students and recent quiz sessions in parallel with field projection
        const [usersSnap, sessionsSnap] = await Promise.all([
            db.collection('users')
                .where('role', '==', 'student')
                .select('displayName', 'photoURL', 'certificationLevel')
                .get(),
            db.collection('quiz_sessions')
                .where('completedAt', '>=', ninetyDaysAgo)
                .select('userId', 'moduleId', 'score', 'passed')
                .get(),
        ]);

        // Aggregate scores per user
        const userScores = new Map<string, { total: number; count: number; passedModules: Set<string> }>();

        sessionsSnap.docs.forEach((doc: any) => {
            const s = doc.data();
            if (!userScores.has(s.userId)) {
                userScores.set(s.userId, { total: 0, count: 0, passedModules: new Set() });
            }
            const entry = userScores.get(s.userId)!;
            entry.total += s.score ?? 0;
            entry.count += 1;
            if (s.passed) entry.passedModules.add(s.moduleId);
        });

        // Build and rank — return only the fields the UI needs
        const ranked: LeaderboardEntry[] = usersSnap.docs
            .map((doc: any) => {
                const u = doc.data();
                const scores = userScores.get(doc.id);
                return {
                    uid: doc.id,
                    displayName: u.displayName ?? 'Usuario',
                    photoURL: u.photoURL || undefined,
                    totalScore: scores ? Math.round(scores.total / scores.count) : 0,
                    passedModules: scores ? scores.passedModules.size : 0,
                    certificationLevel: u.certificationLevel ?? 'none',
                };
            })
            .filter((u: any) => u.totalScore > 0)
            .sort((a: any, b: any) => b.totalScore - a.totalScore)
            .slice(0, 20);

        return NextResponse.json(
            { ranked },
            {
                headers: {
                    // Cache response 60 s on CDN/browser — leaderboard doesn't need real-time precision
                    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
                },
            }
        );
    } catch (error) {
        console.error('Error computing leaderboard:', error);
        return NextResponse.json({ error: 'Error al cargar el leaderboard' }, { status: 500 });
    }
}
