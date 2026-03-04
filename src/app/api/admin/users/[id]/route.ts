import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { getServerUser } from '@/lib/server-auth';

export const runtime = 'nodejs';

/**
 * Verifies the request Origin matches the expected app origin.
 * Defense-in-depth against CSRF (primary protection is already SameSite=lax cookie,
 * which prevents browsers from sending cookies on cross-origin DELETE requests).
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

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } | Promise<{ id: string }> }
) {
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

        // En Next.js 15+, params es una Promesa
        const resolvedParams = await params;
        const uid = resolvedParams.id;

        if (!uid) {
            return NextResponse.json({ error: 'UID de usuario no proporcionado' }, { status: 400 });
        }

        // Prevent admins from deleting themselves
        if (uid === user.uid) {
            return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 400 });
        }

        if (!process.env.FIREBASE_PRIVATE_KEY) {
            return NextResponse.json(
                { error: 'Configuración de servidor incompleta' },
                { status: 500 }
            );
        }

        const adminAuth = getAdminAuth();
        const adminDb = getAdminDb();

        // 1. Eliminar de Firebase Authentication
        try {
            await adminAuth.deleteUser(uid);
        } catch (authError: any) {
            if (authError.code !== 'auth/user-not-found') {
                console.error('Error eliminando usuario de Authentication:', authError);
                throw authError;
            }
        }

        // 2. Eliminar documento de Firestore
        await adminDb.collection('users').doc(uid).delete();

        return NextResponse.json({ success: true, message: 'Usuario eliminado completamente' });

    } catch (error: any) {
        console.error('Error eliminando usuario completo:', error);
        return NextResponse.json(
            { error: 'Error al eliminar el usuario' },
            { status: 500 }
        );
    }
}
