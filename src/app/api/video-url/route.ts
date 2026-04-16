import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, getAdminStorage } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

const BUCKET_NAME = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'mitalento-ia.firebasestorage.app';
const SIGNED_URL_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

/**
 * Extracts the storage file path from a Firebase Storage download URL.
 * URL format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encoded-path}?alt=media&token=...
 */
function extractStoragePath(downloadUrl: string): string | null {
    try {
        const url = new URL(downloadUrl);
        const match = url.pathname.match(/\/o\/(.+)$/);
        if (!match) return null;
        return decodeURIComponent(match[1]);
    } catch {
        return null;
    }
}

export async function POST(request: NextRequest) {
    try {
        const nextCookies = await cookies();
        const sessionCookie = nextCookies.get('__session')?.value;
        if (!sessionCookie) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const auth = getAdminAuth();
        await auth.verifyIdToken(sessionCookie, true);

        const { moduleId } = await request.json();
        if (!moduleId || typeof moduleId !== 'string') {
            return NextResponse.json({ error: 'Missing moduleId' }, { status: 400 });
        }

        const db = getAdminDb();
        const moduleDoc = await db.collection('modules').doc(moduleId).get();
        if (!moduleDoc.exists) {
            return NextResponse.json({ error: 'Module not found' }, { status: 404 });
        }

        const videoUrl = moduleDoc.data()?.videoUrl;
        if (!videoUrl) {
            return NextResponse.json({ error: 'No video for this module' }, { status: 404 });
        }

        const storagePath = extractStoragePath(videoUrl);
        if (!storagePath) {
            return NextResponse.json({ error: 'Invalid video URL' }, { status: 400 });
        }

        const storage = getAdminStorage();
        const bucket = storage.bucket(BUCKET_NAME);
        const file = bucket.file(storagePath);

        const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + SIGNED_URL_EXPIRY_MS,
        });

        return NextResponse.json({ url: signedUrl });
    } catch (error: any) {
        console.error('video-url error:', error?.code || error?.message);
        if (error?.code === 'auth/id-token-expired' || error?.code === 'auth/argument-error') {
            return NextResponse.json({ error: 'Session expired' }, { status: 401 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
