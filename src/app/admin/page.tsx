import { getAdminDb } from '@/lib/firebase-admin';
import { getServerUser } from '@/lib/server-auth';
import { redirect } from 'next/navigation';
import { AdminDashboardClient } from './AdminDashboardClient';

export default async function AdminDashboard() {
    const user = await getServerUser();
    if (!user || user.role !== 'admin') redirect('/');

    const db = getAdminDb();

    // All queries execute in parallel — Cloud Run→Firestore ~2-5ms per query
    const [
        studentsSnap,
        activeCertsCount,
        recentSessionsSnap,
    ] = await Promise.all([
        // Active students — only the fields we need
        db.collection('users')
            .where('role', '==', 'student')
            .where('isActive', '==', true)
            .select('displayName')
            .get(),

        // Count queries: Firestore aggregation — returns only an integer, no documents transferred
        db.collection('certificates')
            .where('isActive', '==', true)
            .count()
            .get()
            .then((snap: any) => snap.data().count),

        // Recent quiz sessions — only last 5 instead of full collection scan
        db.collection('quiz_sessions')
            .orderBy('completedAt', 'desc')
            .limit(5)
            .select('userId', 'score', 'passed', 'completedAt', 'moduleId')
            .get(),
    ]);

    const activeStudents = studentsSnap.size;
    const certificationRate = activeStudents > 0
        ? Math.round((activeCertsCount / activeStudents) * 100)
        : 0;

    // Compute average score from the recent sessions (lightweight approximation)
    let totalScore = 0;
    recentSessionsSnap.docs.forEach((d: any) => {
        totalScore += d.data().score || 0;
    });
    const averageScore = recentSessionsSnap.size > 0
        ? Math.round(totalScore / recentSessionsSnap.size)
        : 0;

    // Build name map only for UIDs that appear in recent activity
    const neededUids = new Set([
        ...recentSessionsSnap.docs.map((d: any) => d.data().userId),
    ]);

    const userNameMap = new Map<string, string>();
    studentsSnap.docs.forEach((d: any) => {
        if (neededUids.has(d.id)) {
            userNameMap.set(d.id, d.data().displayName || 'Estudiante');
        }
    });

    // Build serializable recent activity for the client component
    const recentActivity = recentSessionsSnap.docs.map((d: any) => {
        const s = d.data();
        return {
            id: d.id,
            type: 'quiz' as const,
            studentName: userNameMap.get(s.userId) || 'Estudiante',
            detail: `Quiz completado — ${s.score}%`,
            score: s.score,
            passed: s.passed,
            timestamp: s.completedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        };
    }).slice(0, 5);

    const stats = {
        activeStudents,
        certificationRate,
        pendingEvaluations: 0, // Evaluations now managed manually outside the system
        averageScore,
    };

    return <AdminDashboardClient stats={stats} recentActivity={recentActivity} />;
}
