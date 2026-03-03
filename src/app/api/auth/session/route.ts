import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
    try {
        const { idToken } = await request.json();

        if (!idToken) {
            return NextResponse.json({ error: 'Missing ID token' }, { status: 400 });
        }

        const auth = getAdminAuth();

        // Verificación ligera usando clave pública — no requiere permisos IAM especiales.
        // (createSessionCookie requería Firebase Auth Admin IAM que el service account de
        //  Cloud Functions Gen 2 no siempre tiene. verifyIdToken funciona con cualquier cuenta.)
        await auth.verifyIdToken(idToken);

        // Guardar el ID token verificado en cookie httpOnly.
        // Firebase SDK refresca el token automáticamente — onAuthStateChanged lo re-sincroniza.
        const nextCookies = await cookies();
        nextCookies.set('__session', idToken, {
            maxAge: 60 * 60 * 24 * 14, // 14 días (el token se refresca antes de expirar)
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            sameSite: 'lax',
        });

        return NextResponse.json({ status: 'success' }, { status: 200 });
    } catch (error: any) {
        const message = error?.message || error?.code || String(error);
        console.error('Session error:', message);
        return NextResponse.json({ error: 'Internal Server Error', detail: message }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        const nextCookies = await cookies();
        nextCookies.delete('__session');
        return NextResponse.json({ status: 'success' }, { status: 200 });
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
