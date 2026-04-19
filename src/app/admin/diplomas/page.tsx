import { getAdminDb } from '@/lib/firebase-admin';
import { getServerUser } from '@/lib/server-auth';
import { redirect } from 'next/navigation';
import AdminDiplomasClient from './AdminDiplomasClient';
import type { DiplomaRow } from './AdminDiplomasClient';

export default async function AdminDiplomasPage() {
    const user = await getServerUser();
    if (!user || user.role !== 'admin') redirect('/');

    const db = getAdminDb();

    const [certsSnap, usersSnap] = await Promise.all([
        db.collection('certificates')
            .where('level', '==', 'elite')
            .where('isActive', '==', true)
            .get(),
        db.collection('users')
            .where('role', '==', 'student')
            .select('email', 'photoURL', 'displayName')
            .get(),
    ]);

    const userMap = new Map<string, { email?: string; photoURL?: string; displayName?: string }>();
    usersSnap.docs.forEach((d: any) => {
        const data = d.data();
        userMap.set(d.id, {
            email: data.email,
            photoURL: data.photoURL,
            displayName: data.displayName,
        });
    });

    const rows: DiplomaRow[] = certsSnap.docs
        .map((d: any): DiplomaRow => {
            const data = d.data();
            const profile = userMap.get(data.userId) || {};
            return {
                id: d.id,
                userId: data.userId,
                userName: data.userName || profile.displayName || 'Asesor Urbanity',
                email: profile.email || '',
                photoURL: profile.photoURL,
                issuedAt: data.issuedAt?.toMillis?.() ?? null,
                score: data.score || 0,
                verificationCode: data.verificationCode || '',
                pathTitle: data.pathTitle || 'Alto Desempeño y Proyección a Liderazgo',
            };
        })
        .sort((a: DiplomaRow, b: DiplomaRow) => (b.issuedAt ?? 0) - (a.issuedAt ?? 0));

    return <AdminDiplomasClient rows={rows} />;
}
