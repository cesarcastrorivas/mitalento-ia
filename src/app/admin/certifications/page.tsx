import { getAdminDb } from '@/lib/firebase-admin';
import { getServerUser } from '@/lib/server-auth';
import { User } from '@/types';
import { redirect } from 'next/navigation';
import AdminCertificationsClient from './AdminCertificationsClient';
import type { StudentRow } from './AdminCertificationsClient';

export default async function AdminCertificationsPage() {
    const user = await getServerUser();
    if (!user || user.role !== 'admin') redirect('/');

    const db = getAdminDb();

    // 3 queries run in parallel from Cloud Run (~5ms each)
    const [usersSnap, sessionsSnap, commitmentsSnap] = await Promise.all([
        db.collection('users')
            .where('role', '==', 'student')
            .get(),
        db.collection('quiz_sessions')
            .select('userId', 'score')
            .get(),
        db.collection('commitments')
            .select('userId')
            .get(),
    ]);

    const userScores = new Map<string, { total: number; count: number }>();
    sessionsSnap.docs.forEach((d: any) => {
        const data = d.data();
        const entry = userScores.get(data.userId) || { total: 0, count: 0 };
        entry.total += data.score || 0;
        entry.count += 1;
        userScores.set(data.userId, entry);
    });

    const commitments = new Set<string>();
    commitmentsSnap.docs.forEach((d: any) => commitments.add(d.data().userId));

    // Build serializable student rows for the client
    // attitudinalStatus is now managed manually on the User document by the supervisor
    const students: StudentRow[] = usersSnap.docs.map((d: any) => {
        const data = d.data() as User;
        const scores = userScores.get(d.id);

        return {
            uid: d.id,
            displayName: data.displayName,
            email: data.email,
            photoURL: data.photoURL,
            certificationLevel: (data.certificationLevel as any) || 'none',
            attitudinalStatus: data.attitudinalStatus || 'pending',
            avgScore: scores && scores.count > 0 ? Math.round(scores.total / scores.count) : 0,
            commitment: commitments.has(d.id),
            supervisorFeedback: data.supervisorFeedback || '',
            responses: [],
            stageChecklist: data.stageChecklist || {},
        };
    });

    return <AdminCertificationsClient initialStudents={students} />;
}
