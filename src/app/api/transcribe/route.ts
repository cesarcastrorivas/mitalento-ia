import { NextRequest, NextResponse } from 'next/server';
import { transcribeVideo, secondaryGeminiModel, secondaryFileManager } from '@/lib/gemini';
import { getServerUser } from '@/lib/server-auth';
import { checkRateLimit } from '@/lib/rate-limit';

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

        console.log('Transcribing video:', { videoTitle, requestedBy: user.uid });

        if (!videoUrl) {
            return NextResponse.json(
                { success: false, error: 'Faltan parámetros requeridos (videoUrl es obligatorio)' },
                { status: 400 }
            );
        }

        const result = await transcribeVideo(
            videoUrl,
            videoTitle,
            secondaryGeminiModel,
            secondaryFileManager
        );

        if (!result.success) {
            throw new Error(result.error);
        }

        return NextResponse.json({
            success: true,
            text: result.text,
        });

    } catch (error) {
        console.error('Error in /api/transcribe:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
