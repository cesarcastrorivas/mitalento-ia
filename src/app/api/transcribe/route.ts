import { NextRequest, NextResponse } from 'next/server';
import { transcribeVideo, secondaryGeminiModel, secondaryFileManager } from '@/lib/gemini';
import { getServerUser } from '@/lib/server-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { getAdminDb } from '@/lib/firebase-admin';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
    try {
        const user = await getServerUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        if (user.role !== 'admin') {
            return NextResponse.json({ success: false, error: 'Acceso denegado' }, { status: 403 });
        }

        const rl = await checkRateLimit(user.uid, 'transcribe', 5);
        if (!rl.allowed) {
            return NextResponse.json(
                { success: false, error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' },
                { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetInMs / 1000)) } }
            );
        }

        const body = await request.json();
        const { videoUrl, videoTitle = 'Video del Módulo' } = body;

        console.log('Transcribing video (async):', { videoTitle, requestedBy: user.uid });

        if (!videoUrl) {
            return NextResponse.json(
                { success: false, error: 'Faltan parámetros requeridos (videoUrl es obligatorio)' },
                { status: 400 }
            );
        }

        // Create a task document in Firestore
        const db = getAdminDb();
        const taskRef = await db.collection('transcription_tasks').add({
            status: 'processing',
            videoUrl,
            videoTitle,
            requestedBy: user.uid,
            createdAt: new Date(),
            text: '',
            error: '',
        });

        const taskId = taskRef.id;
        console.log('[transcribe] Task created:', taskId);

        // Process in background - don't await
        transcribeVideo(videoUrl, videoTitle, secondaryGeminiModel, secondaryFileManager)
            .then(async (result) => {
                await db.collection('transcription_tasks').doc(taskId).update({
                    status: result.success ? 'completed' : 'failed',
                    text: result.text || '',
                    error: result.error || '',
                    completedAt: new Date(),
                });
                console.log(`[transcribe] Task ${taskId} ${result.success ? 'completed' : 'failed'}`);
            })
            .catch(async (err) => {
                await db.collection('transcription_tasks').doc(taskId).update({
                    status: 'failed',
                    error: err instanceof Error ? err.message : String(err),
                    completedAt: new Date(),
                });
                console.error(`[transcribe] Task ${taskId} error:`, err);
            });

        // Respond immediately
        return NextResponse.json({
            success: true,
            taskId,
            status: 'processing',
        });

    } catch (error) {
        console.error('Error in /api/transcribe:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
