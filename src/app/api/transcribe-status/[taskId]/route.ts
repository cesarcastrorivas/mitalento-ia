import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/server-auth';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    try {
        const user = await getServerUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Tu sesión ha expirado. Por favor, recarga la página o inicia sesión nuevamente.' }, { status: 401 });
        }

        const { taskId } = await params;
        const db = getAdminDb();
        const taskDoc = await db.collection('transcription_tasks').doc(taskId).get();

        if (!taskDoc.exists) {
            return NextResponse.json({ success: false, error: 'Tarea no encontrada' }, { status: 404 });
        }

        const task = taskDoc.data()!;

        // Only the requester or admins can check status
        if (task.requestedBy !== user.uid && user.role !== 'admin') {
            return NextResponse.json({ success: false, error: 'Acceso denegado' }, { status: 403 });
        }

        return NextResponse.json({
            success: true,
            status: task.status,
            text: task.text || '',
            error: task.error || '',
        });

    } catch (error) {
        console.error('Error in /api/transcribe-status:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
