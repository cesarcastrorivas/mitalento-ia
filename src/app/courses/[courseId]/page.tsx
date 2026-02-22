'use client';

import { useEffect, useState, use } from 'react';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Module } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import LoadingScreen from '@/components/LoadingScreen';

interface ModuleWithProgress extends Module {
    completed: boolean;
    score: number | null;
    attempts: number;
}

export default function CourseModulesPage({ params }: { params: Promise<{ courseId: string }> }) {
    const { courseId } = use(params);
    const { user } = useAuth();
    const router = useRouter();

    const [loadingMessage, setLoadingMessage] = useState('Cargando curso...');

    useEffect(() => {
        if (user && courseId) {
            redirectToNextModule();
        }
    }, [user, courseId]);

    const redirectToNextModule = async () => {
        try {
            // 1. Cargar Módulos del Curso
            const modulesQuery = query(
                collection(db, 'modules'),
                where('courseId', '==', courseId),
                where('isActive', '==', true),
                orderBy('order', 'asc')
            );
            const modulesSnapshot = await getDocs(modulesQuery);
            const modulesData = modulesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Module));

            if (modulesData.length === 0) {
                // Si no hay módulos, redirigir al dashboard con un mensaje (o mostrar error aquí)
                console.warn('Curso sin módulos');
                router.replace('/dashboard');
                return;
            }

            // 2. Cargar progreso del usuario
            const userDoc = await getDoc(doc(db, 'users', user!.uid));
            const userProgress = userDoc.data()?.progress || {};

            // 3. Encontrar el primer módulo NO completado
            const nextModule = modulesData.find(m => !userProgress[m.id]?.completed);

            // 4. Redirigir al módulo encontrado, o al último si todos están completos, o al primero si nada está empezado.
            const targetModuleId = nextModule ? nextModule.id : modulesData[0].id;

            // Si todos están completos, quizás queramos ir al primero para repasar, o al último.
            // Por ahora, lógica simple: Ir al primero pendiente, o al primero de todos.

            setLoadingMessage('Redirigiendo a tu lección...');
            router.replace(`/modules/${targetModuleId}`);

        } catch (error) {
            console.error('Error determining next module:', error);
            router.replace('/dashboard');
        }
    };

    return <LoadingScreen message={loadingMessage} />;
}
