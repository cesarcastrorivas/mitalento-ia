import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getFirestoreTimestamp } from '@/lib/firebase-admin';
import { getServerUser } from '@/lib/server-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import crypto from 'crypto';
import { canGenerateCertificate } from '@/lib/grading-utils';

export async function POST(req: NextRequest) {
    try {
        const user = await getServerUser();
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { userId, pathId } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        // Students can only generate their own certificate
        if (user.role !== 'admin' && userId !== user.uid) {
            return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
        }

        // 10 intentos/hora por usuario
        const rl = await checkRateLimit(user.uid, 'generate-certificate', 10);
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' },
                { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetInMs / 1000)) } }
            );
        }

        const db = getAdminDb();

        // Get user data
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
        }

        const userData = userDoc.data()!;

        // Check if an active certificate already exists for this path
        let existingQuery = db.collection('certificates')
            .where('userId', '==', userId)
            .where('isActive', '==', true);

        if (pathId) {
            existingQuery = existingQuery.where('pathId', '==', pathId) as any;
        }

        const existingSnap = await existingQuery.get();

        if (!existingSnap.empty) {
            const existing = { id: existingSnap.docs[0].id, ...existingSnap.docs[0].data() };
            return NextResponse.json({ success: true, certificate: existing });
        }

        // Verify the user completed the path
        const eligibility = await canGenerateCertificate(userId, pathId);
        if (!eligibility.eligible) {
            return NextResponse.json(
                { error: eligibility.reason || 'No cumples los requisitos para obtener un certificado.' },
                { status: 403 }
            );
        }

        const avgScore = eligibility.averageScore;
        const certLevel = eligibility.certificationLevel || userData.certificationLevel || 'fundamental';

        const verificationCode = crypto.randomBytes(8).toString('hex').toUpperCase();

        const certData: Record<string, any> = {
            userId,
            userName: userData.displayName || 'Asesor Urbanity',
            level: certLevel,
            score: avgScore,
            verificationCode,
            isActive: true,
            issuedAt: getFirestoreTimestamp().now(),
        };

        if (eligibility.completedPathId) certData.pathId = eligibility.completedPathId;
        if (eligibility.pathTitle) certData.pathTitle = eligibility.pathTitle;

        const certRef = await db.collection('certificates').add(certData);

        return NextResponse.json({
            success: true,
            certificate: { id: certRef.id, ...certData },
        });

    } catch (error) {
        console.error('Error generating certificate:', error);
        return NextResponse.json({ error: 'Error generando certificado' }, { status: 500 });
    }
}
