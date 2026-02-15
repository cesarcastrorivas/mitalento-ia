import { NextRequest, NextResponse } from 'next/server';
import { transcribeVideo } from '@/lib/gemini';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { videoUrl, videoTitle = 'Video del Módulo' } = body;

        console.log('Transcribing video:', { videoTitle });

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
            {
                success: false,
                error: error instanceof Error ? error.message : 'Error desconocido'
            },
            { status: 500 }
        );
    }
}
