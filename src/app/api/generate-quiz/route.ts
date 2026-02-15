import { NextRequest, NextResponse } from 'next/server';
import { generateQuizFromTranscription } from '@/lib/gemini';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { moduleId, userId, transcription, videoTitle = 'Video del Módulo', questionCount = 5 } = body;

        console.log('Generating quiz from transcription for:', { moduleId, userId, videoTitle });

        if (!moduleId || !userId || !transcription) {
            return NextResponse.json(
                { success: false, error: 'Faltan parámetros requeridos (moduleId, userId y transcription son obligatorios)' },
                { status: 400 }
            );
        }

        const result = await generateQuizFromTranscription(
            transcription,
            videoTitle,
            userId,
            moduleId,
            questionCount
        );

        if (!result.success) {
            throw new Error(result.error);
        }

        console.log('Quiz generated successfully with', result.questions.length, 'questions (from transcription)');

        return NextResponse.json({
            success: true,
            questions: result.questions,
        });

    } catch (error) {
        console.error('Error in /api/generate-quiz:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Error desconocido'
            },
            { status: 500 }
        );
    }
}
