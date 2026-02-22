import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, addDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import crypto from 'crypto';
import { canGenerateCertificate } from '@/lib/grading-utils';

export async function POST(req: NextRequest) {
    try {
        const { userId, pathId } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        // Get user data
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userData = userDoc.data();

        // Check if an active certificate already exists for this path (or globally if no pathId)
        const existingQueryConstraints = [
            where('userId', '==', userId),
            where('isActive', '==', true),
        ];
        if (pathId) {
            existingQueryConstraints.push(where('pathId', '==', pathId));
        }
        const existingQuery = query(
            collection(db, 'certificates'),
            ...existingQueryConstraints
        );
        const existingSnap = await getDocs(existingQuery);

        // If pathId provided, only match certificates for that specific path
        if (!existingSnap.empty) {
            const existing = { id: existingSnap.docs[0].id, ...existingSnap.docs[0].data() };
            return NextResponse.json({ success: true, certificate: existing });
        }

        // ═══ VALIDACIÓN: Verificar que el usuario completó la ruta ═══
        const eligibility = await canGenerateCertificate(userId, pathId);
        if (!eligibility.eligible) {
            return NextResponse.json(
                { error: eligibility.reason || 'No cumples los requisitos para obtener un certificado.' },
                { status: 403 }
            );
        }

        const avgScore = eligibility.averageScore;
        const certLevel = eligibility.certificationLevel || userData.certificationLevel || 'fundamental';

        // Generate unique verification code
        const verificationCode = crypto.randomBytes(8).toString('hex').toUpperCase();

        // Create certificate
        const certData: Record<string, any> = {
            userId,
            userName: userData.displayName || 'Asesor Urbanity',
            level: certLevel,
            score: avgScore,
            verificationCode,
            isActive: true,
            issuedAt: Timestamp.now(),
        };

        // Add path info if available
        if (eligibility.completedPathId) {
            certData.pathId = eligibility.completedPathId;
        }
        if (eligibility.pathTitle) {
            certData.pathTitle = eligibility.pathTitle;
        }

        const certRef = await addDoc(collection(db, 'certificates'), certData);

        return NextResponse.json({
            success: true,
            certificate: { id: certRef.id, ...certData },
        });

    } catch (error) {
        console.error('Error generating certificate:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Error desconocido' },
            { status: 500 }
        );
    }
}
