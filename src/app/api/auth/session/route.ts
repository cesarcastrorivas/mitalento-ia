import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        const { idToken } = await request.json();

        if (!idToken || typeof idToken !== 'string') {
            return NextResponse.json({ error: 'Missing or invalid ID token' }, { status: 400 });
        }

        const auth = getAdminAuth();

        // Verify token with revocation check for stronger security
        const decodedToken = await auth.verifyIdToken(idToken, true);

        // Validate that the token was issued recently (max 5 minutes)
        // Prevents replay attacks with leaked/stolen tokens
        const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 5 * 60;
        if (decodedToken.iat < fiveMinutesAgo) {
            return NextResponse.json(
                { error: 'Token too old. Please refresh your session.' },
                { status: 401 }
            );
        }

        // Store verified ID token in httpOnly cookie.
        // maxAge aligned with Firebase ID token lifetime (1 hour).
        // Firebase SDK refreshes the token automatically — onAuthStateChanged re-syncs it.
        const nextCookies = await cookies();
        nextCookies.set('__session', idToken, {
            maxAge: 60 * 60, // 1 hour (matches Firebase ID token real expiration)
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            sameSite: 'lax',
        });

        return NextResponse.json({ status: 'success' }, { status: 200 });
    } catch (error: any) {
        console.error('Session creation error:', error?.code || error?.message || error);
        // Never expose internal error details to the client
        return NextResponse.json({ error: 'Authentication error' }, { status: 401 });
    }
}

export async function DELETE() {
    try {
        const nextCookies = await cookies();
        nextCookies.set('__session', '', {
            maxAge: 0,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            sameSite: 'lax',
        });
        return NextResponse.json({ status: 'success' }, { status: 200 });
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
