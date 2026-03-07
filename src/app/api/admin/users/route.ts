import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, getFirestoreTimestamp } from '@/lib/firebase-admin';
import { getServerUser } from '@/lib/server-auth';

export const runtime = 'nodejs';

/**
 * Verifies the request Origin matches the expected app origin.
 * Defense-in-depth against CSRF.
 */
function verifySameOrigin(request: NextRequest): boolean {
    const origin = request.headers.get('origin');
    if (!origin) return false;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
        try {
            return new URL(origin).host === new URL(appUrl).host;
        } catch {
            return false;
        }
    }
    // Development: allow localhost origins
    return origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1');
}

export async function POST(request: NextRequest) {
    try {
        // CSRF: verify request comes from same origin
        if (!verifySameOrigin(request)) {
            return NextResponse.json({ error: 'Solicitud no permitida' }, { status: 403 });
        }

        const user = await getServerUser();
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        if (user.role !== 'admin') {
            return NextResponse.json({ error: 'Acceso denegado: se requiere rol de administrador' }, { status: 403 });
        }

        if (!process.env.ADMIN_PRIVATE_KEY) {
            return NextResponse.json(
                { error: 'Configuración de servidor incompleta' },
                { status: 500 }
            );
        }

        const body = await request.json();
        const { email, password, displayName, role } = body;

        if (!email || !password || !displayName) {
            return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
        }

        const adminAuth = getAdminAuth();
        const adminDb = getAdminDb();
        const Timestamp = getFirestoreTimestamp();

        // 1. Create User in Firebase Auth
        let userRecord;
        try {
            userRecord = await adminAuth.createUser({
                email,
                password,
                displayName,
            });
        } catch (authError: any) {
            if (authError.code === 'auth/email-already-exists') {
                return NextResponse.json(
                    { error: 'El correo electrónico ya está registrado en Firebase Authentication.' },
                    { status: 400 }
                );
            }
            throw authError;
        }

        // 2. Create User Document in Firestore
        const newUser = {
            uid: userRecord.uid,
            email,
            displayName,
            role: role || 'student',
            createdAt: Timestamp.now(),
            createdBy: user.uid,
            isActive: true,
            assignedPathIds: []
        };

        await adminDb.collection('users').doc(userRecord.uid).set(newUser);

        return NextResponse.json({ success: true, message: 'Usuario creado exitosamente', user: newUser });

    } catch (error: any) {
        console.error('Error creando usuario:', error);
        return NextResponse.json(
            { error: error.message || 'Error al crear el usuario' },
            { status: 500 }
        );
    }
}
