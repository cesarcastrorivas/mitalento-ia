import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, getFirestoreTimestamp } from '@/lib/firebase-admin';
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

/**
 * DELETE /api/admin/users/[id]
 *
 * Soft Delete (Baja Lógica):
 * 1. Marca isActive: false en Firestore (preserva el documento para auditorías y reportes).
 * 2. Deshabilita la cuenta en Firebase Auth (impide login).
 * 3. Revoca refresh tokens activos (cierra sesiones existentes).
 */
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

        // Prevent admins from deactivating themselves
        if (uid === user.uid) {
            return NextResponse.json({ error: 'No puedes dar de baja tu propia cuenta' }, { status: 400 });
        }

        if (!process.env.ADMIN_PRIVATE_KEY) {
            return NextResponse.json(
                { error: 'Configuración de servidor incompleta' },
                { status: 500 }
            );
        }

        const adminAuth = getAdminAuth();
        const adminDb = getAdminDb();
        const Timestamp = getFirestoreTimestamp();

        // 0. Verificar que el documento del usuario exista en Firestore
        const userDoc = await adminDb.collection('users').doc(uid).get();
        if (!userDoc.exists) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
        }

        const userData = userDoc.data();
        if (userData?.isActive === false) {
            return NextResponse.json({ error: 'El usuario ya se encuentra dado de baja' }, { status: 409 });
        }

        // 1. Deshabilitar en Firebase Authentication (impide login)
        try {
            await adminAuth.updateUser(uid, { disabled: true });
        } catch (authError: any) {
            if (authError.code !== 'auth/user-not-found') {
                console.error('Error deshabilitando usuario en Authentication:', authError);
                throw authError;
            }
            // Si no existe en Auth, continuar igualmente con la baja en Firestore
        }

        // 2. Revocar refresh tokens activos (cierra sesiones existentes)
        try {
            await adminAuth.revokeRefreshTokens(uid);
        } catch (revokeError: any) {
            // No bloquear la operación si falla la revocación
            console.warn('No se pudieron revocar los tokens:', revokeError?.message);
        }

        // 3. Soft Delete en Firestore: preservar documento, marcar como inactivo
        await adminDb.collection('users').doc(uid).update({
            isActive: false,
            deactivatedAt: Timestamp.now(),
            deactivatedBy: user.uid,
        });

        return NextResponse.json({
            success: true,
            message: 'Usuario dado de baja exitosamente',
        });

    } catch (error: any) {
        console.error('Error al dar de baja al usuario:', error);
        return NextResponse.json(
            { error: 'Error al dar de baja al usuario' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/admin/users/[id]
 *
 * Batch-update user fields server-side.
 * One write from Cloud Run (~5ms) instead of N writes from Lima browser (~150ms each).
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } | Promise<{ id: string }> }
) {
    try {
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

        const resolvedParams = await params;
        const uid = resolvedParams.id;

        if (!uid) {
            return NextResponse.json({ error: 'UID de usuario no proporcionado' }, { status: 400 });
        }

        const body = await request.json();

        // Whitelist of allowed fields to prevent arbitrary writes
        const allowedFields = ['assignedPathIds', 'displayName', 'isActive', 'certificationLevel', 'attitudinalStatus', 'stageChecklist', 'supervisorFeedback'];
        const updates: Record<string, any> = {};

        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updates[field] = body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No se proporcionaron campos válidos para actualizar' }, { status: 400 });
        }

        updates.updatedAt = new Date();

        const adminDb = getAdminDb();
        await adminDb.collection('users').doc(uid).update(updates);

        return NextResponse.json({ success: true, message: 'Usuario actualizado correctamente' });

    } catch (error: any) {
        console.error('Error actualizando usuario:', error);
        return NextResponse.json(
            { error: 'Error al actualizar el usuario' },
            { status: 500 }
        );
    }
}
