import { NextRequest, NextResponse } from 'next/server';
import { transcribeVideo } from '@/lib/gemini';
import { getServerUser } from '@/lib/server-auth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
    try {
        const user = await getServerUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        // Transcription is an admin-only operation (used when creating/editing modules)
        if (user.role !== 'admin') {
            return NextResponse.json({ success: false, error: 'Acceso denegado' }, { status: 403 });
        }

        // 5 transcripciones/hora por admin (operación costosa)
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

        const result = await transcribeVideo(videoUrl, videoTitle);

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
            { success: false, error: 'Error procesando video' },
            { status: 500 }
        );
    }
}
