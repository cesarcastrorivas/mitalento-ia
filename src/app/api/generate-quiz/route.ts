import { NextRequest, NextResponse } from 'next/server';
import { generateQuizFromTranscription } from '@/lib/gemini';
import { getServerUser } from '@/lib/server-auth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
    try {
        const user = await getServerUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        // Admins get a higher limit (50/h), students 15/h
        const limit = user.role === 'admin' ? 50 : 15;
        const rl = await checkRateLimit(user.uid, 'generate-quiz', limit);
        if (!rl.allowed) {
            return NextResponse.json(
                { success: false, error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' },
                { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetInMs / 1000)) } }
            );
        }

        const body = await request.json();
        const { moduleId, userId, transcription, videoTitle = 'Video del Módulo', videoContext, questionCount = 5 } = body;

        // Derive admin status from the verified server-side role — never trust the client
        const isAdmin = user.role === 'admin';

        // Students can only generate quizzes for themselves
        const targetUserId = isAdmin ? (userId || 'admin-generation') : user.uid;

        console.log('Generating quiz from transcription for:', { moduleId, userId: isAdmin ? 'Admin' : targetUserId, videoTitle });

        if (!moduleId || !transcription) {
            return NextResponse.json(
                { success: false, error: 'Faltan parámetros requeridos (moduleId y transcription son obligatorios)' },
                { status: 400 }
            );
        }

        const count = isAdmin ? 10 : questionCount;

        const result = await generateQuizFromTranscription(
            transcription,
            videoTitle,
            targetUserId,
            moduleId,
            count,
            videoContext
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
            { success: false, error: 'Error generando quiz' },
            { status: 500 }
        );
    }
}
