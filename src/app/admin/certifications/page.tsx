import { getAdminDb, getFirestoreTimestamp } from '@/lib/firebase-admin';
import { getServerUser } from '@/lib/server-auth';
import { CertificationLevel, User } from '@/types';
import { buildModuleLevelMap } from '@/lib/grading-utils';
import { FIXED_PATHS } from '@/lib/constants';
import { redirect } from 'next/navigation';
import crypto from 'crypto';
import AdminCertificationsClient from './AdminCertificationsClient';
import type { StudentRow } from './AdminCertificationsClient';

// Criterios de certificación Élite (espejo de STAGE_REQUIREMENTS.elite en el cliente)
const ELITE_CHECKLIST = [
    'Módulos completados (Alto Desempeño y Liderazgo)',
    'Caso práctico estratégico resuelto',
    'Presentación de plan de acción 30-60-90 días',
    'Evaluación actitudinal final completada',
];
const MIN_CERT_SCORE = 80;

export default async function AdminCertificationsPage() {
    const user = await getServerUser();
    if (!user || user.role !== 'admin') redirect('/');

    const db = getAdminDb();

    // 7 queries run in parallel from Cloud Run (~5ms each)
    const [
        usersSnap,
        sessionsSnap,
        commitmentsSnap,
        modulesSnap,
        coursesSnap,
        dynamicPathsSnap,
        eliteCertsSnap,
    ] = await Promise.all([
        db.collection('users')
            .where('role', '==', 'student')
            .get(),
        db.collection('quiz_sessions')
            .select('userId', 'moduleId', 'score', 'passed')
            .get(),
        db.collection('commitments')
            .select('userId')
            .get(),
        db.collection('modules')
            .where('isActive', '==', true)
            .select('courseId', 'pathId')
            .get(),
        db.collection('courses')
            .where('isActive', '==', true)
            .select('pathId')
            .get(),
        db.collection('learning_paths')
            .where('isActive', '==', true)
            .select('certificationLevel', 'title')
            .get(),
        db.collection('certificates')
            .where('level', '==', 'elite')
            .where('isActive', '==', true)
            .select('userId')
            .get(),
    ]);

    // moduleId → certificationLevel (FIXED_PATHS + Firestore override, con fallback vía courseId)
    const moduleToLevel = buildModuleLevelMap(
        modulesSnap.docs,
        coursesSnap.docs,
        dynamicPathsSnap.docs,
    );

    // Agrupar quiz_sessions aprobadas por (userId, certificationLevel del módulo)
    type LevelScores = Partial<Record<CertificationLevel, { total: number; count: number }>>;
    const userLevelScores = new Map<string, LevelScores>();
    sessionsSnap.docs.forEach((d: any) => {
        const data = d.data();
        if (!data.passed) return;
        const level = moduleToLevel.get(data.moduleId);
        if (!level || level === 'none') return;
        const byLevel = userLevelScores.get(data.userId) || {};
        const entry = byLevel[level] || { total: 0, count: 0 };
        entry.total += data.score || 0;
        entry.count += 1;
        byLevel[level] = entry;
        userLevelScores.set(data.userId, byLevel);
    });

    const commitments = new Set<string>();
    commitmentsSnap.docs.forEach((d: any) => commitments.add(d.data().userId));

    // Set de userIds que ya tienen un certificado élite activo
    const certByUser = new Set<string>();
    eliteCertsSnap.docs.forEach((d: any) => certByUser.add(d.data().userId));

    // Identificar la ruta élite (para pathId/pathTitle en el certificado auto-generado)
    let eliteId = 'path-elite';
    let eliteTitle = 'Alto Desempeño y Proyección a Liderazgo';
    const fixedElite = FIXED_PATHS.find(p => p.certificationLevel === 'elite');
    if (fixedElite) { eliteId = fixedElite.id; eliteTitle = fixedElite.title; }
    const dynamicElite = dynamicPathsSnap.docs.find((d: any) => d.data().certificationLevel === 'elite');
    if (dynamicElite) { eliteId = dynamicElite.id; eliteTitle = dynamicElite.data().title || eliteTitle; }

    const certsToCreate: Array<{ userId: string; userName: string; score: number }> = [];

    // Build serializable student rows for the client
    // avgScore corresponde al promedio de quizzes aprobados del nivel actual del alumno
    const students: StudentRow[] = usersSnap.docs.map((d: any) => {
        const data = d.data() as User;
        const currentLevel = (data.certificationLevel as CertificationLevel) || 'none';
        const scoreEntry = currentLevel !== 'none'
            ? userLevelScores.get(d.id)?.[currentLevel]
            : undefined;

        const avgScore = scoreEntry && scoreEntry.count > 0
            ? Math.round(scoreEntry.total / scoreEntry.count)
            : 0;

        const allEliteChecklistDone = currentLevel === 'elite'
            && ELITE_CHECKLIST.every(r => !!data.stageChecklist?.[r]);
        const isCertified = currentLevel === 'elite'
            && allEliteChecklistDone
            && avgScore >= MIN_CERT_SCORE;

        if (isCertified && !certByUser.has(d.id)) {
            certsToCreate.push({
                userId: d.id,
                userName: data.displayName || 'Asesor Urbanity',
                score: avgScore,
            });
        }

        return {
            uid: d.id,
            displayName: data.displayName,
            email: data.email,
            photoURL: data.photoURL,
            certificationLevel: currentLevel,
            attitudinalStatus: data.attitudinalStatus || 'pending',
            avgScore,
            commitment: commitments.has(d.id),
            supervisorFeedback: data.supervisorFeedback || '',
            responses: [],
            stageChecklist: data.stageChecklist || {},
            isCertified,
        };
    });

    // Auto-generar certificados faltantes a nombre de URBANITY ACADEMY.
    // Se usa doc(id).create() con ID determinístico para idempotencia ante requests concurrentes.
    if (certsToCreate.length > 0) {
        const Timestamp = getFirestoreTimestamp();
        await Promise.all(certsToCreate.map(async (c) => {
            const docId = `${c.userId}_${eliteId}`;
            const verificationCode = crypto.randomBytes(8).toString('hex').toUpperCase();
            try {
                await db.collection('certificates').doc(docId).create({
                    userId: c.userId,
                    userName: c.userName,
                    level: 'elite',
                    pathId: eliteId,
                    pathTitle: eliteTitle,
                    score: c.score,
                    verificationCode,
                    isActive: true,
                    issuedAt: Timestamp.now(),
                    issuedBy: 'URBANITY ACADEMY',
                    autoGenerated: true,
                });
            } catch (err: any) {
                if (err?.code !== 6) console.error('Error auto-creando certificado élite:', err);
            }
        }));
    }

    return <AdminCertificationsClient initialStudents={students} />;
}
