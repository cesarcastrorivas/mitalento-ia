import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function DELETE(
    request: Request,
    { params }: { params: { id: string } | Promise<{ id: string }> } // Type checking for both versions
) {
    try {
        // En Next.js 15+, params es una Promesa
        const resolvedParams = await params;
        const uid = resolvedParams.id;

        if (!uid) {
            return NextResponse.json({ error: 'UID de usuario no proporcionado' }, { status: 400 });
        }

        if (!process.env.FIREBASE_PRIVATE_KEY) {
            return NextResponse.json(
                {
                    error: 'Falta configurar FIREBASE_PRIVATE_KEY en .env.local para eliminar usuarios de Authentication'
                },
                { status: 500 }
            );
        }

        // 1. Eliminar de Firebase Authentication (Esto requiere Firebase Admin)
        try {
            await adminAuth.deleteUser(uid);
        } catch (authError: any) {
            // Si el error es auth/user-not-found, sigamos adelante para limpiar Firestore
            if (authError.code !== 'auth/user-not-found') {
                console.error('Error eliminando usuario de Authentication:', authError);
                throw authError; // Relanzar si es otro error crítico
            }
        }

        // 2. Eliminar documento de Firestore
        await adminDb.collection('users').doc(uid).delete();

        return NextResponse.json({ success: true, message: 'Usuario eliminado completamente' });
    } catch (error: any) {
        console.error('Error eliminando usuario completo:', error);
        return NextResponse.json(
            { error: error?.message || 'Error desconocido al eliminar' },
            { status: 500 }
        );
    }
}
