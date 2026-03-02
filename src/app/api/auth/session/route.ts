import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';

// The max expiry time for Firebase session cookies is 14 days.
const EXPIRES_IN = 60 * 60 * 24 * 14 * 1000;

export async function POST(request: NextRequest) {
    try {
        const { idToken } = await request.json();

        if (!idToken) {
            return NextResponse.json({ error: 'Missing ID token' }, { status: 400 });
        }

        const auth = getAdminAuth();

        // Decodificar el token para asegurarnos de que el usuario haya iniciado sesión recientemente
        // antes de crear la session cookie (requerimiento de seguridad de Firebase).
        const decodedIdToken = await auth.verifyIdToken(idToken);
        if (new Date().getTime() / 1000 - decodedIdToken.auth_time > 5 * 60) {
            return NextResponse.json({ error: 'Recent sign in required' }, { status: 401 });
        }

        // Crear la cookie de sesión de Firebase
        const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: EXPIRES_IN });

        // Establecer la cookie HTTP-Only segura
        const nextCookies = await cookies();
        nextCookies.set('__session', sessionCookie, {
            maxAge: EXPIRES_IN,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            sameSite: 'lax',
        });

        return NextResponse.json({ status: 'success' }, { status: 200 });
    } catch (error) {
        console.error('Session Cookie error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        const nextCookies = await cookies();
        nextCookies.delete('__session');

        return NextResponse.json({ status: 'success' }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
