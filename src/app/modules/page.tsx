'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Module, QuizSession } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface ModuleWithProgress extends Module {
    completed: boolean;
    score: number | null;
    attempts: number;
}

export default function ModulesPage() {
    const { user } = useAuth();
    const [modules, setModules] = useState<ModuleWithProgress[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            loadModulesWithProgress();
        }
    }, [user]);

    const loadModulesWithProgress = async () => {
        try {
            // Cargar módulos activos
            const modulesQuery = query(
                collection(db, 'modules'),
                where('isActive', '==', true)
            );
            const modulesSnapshot = await getDocs(modulesQuery);
            let modulesData = modulesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Module));

            // Ordenar en cliente
            modulesData = modulesData.sort((a, b) => a.order - b.order);

            // Cargar progreso del usuario
            const progressDoc = await getDoc(doc(db, 'users', user!.uid));
            const userProgress = progressDoc.data()?.progress || {};

            // Cargar sesiones de quiz
            const quizQuery = query(
                collection(db, 'quiz_sessions'),
                where('userId', '==', user!.uid)
            );
            const quizSnapshot = await getDocs(quizQuery);
            const quizSessions = quizSnapshot.docs.map(doc => doc.data() as QuizSession);

            // Combinar datos
            const modulesWithProgress: ModuleWithProgress[] = modulesData.map(module => {
                const moduleSessions = quizSessions.filter(s => s.moduleId === module.id);
                const bestSession = moduleSessions.reduce((best, current) =>
                    current.score > (best?.score || 0) ? current : best
                    , null as QuizSession | null);

                return {
                    ...module,
                    completed: userProgress[module.id]?.completed || false,
                    score: bestSession?.score ?? null,
                    attempts: moduleSessions.length,
                };
            });

            setModules(modulesWithProgress);
        } catch (error: unknown) {
            console.error('Error loading modules:', error);
            const firebaseError = error as { message?: string };
            alert(`Error al cargar módulos: ${firebaseError.message || 'Error desconocido'}`);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="spinner text-primary-500"></div>
            </div>
        );
    }

    const completedCount = modules.filter(m => m.completed).length;
    const totalModules = modules.length;
    const progress = totalModules > 0 ? (completedCount / totalModules) * 100 : 0;

    return (
        <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">
            <header className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-center md:text-left">
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Módulos de Entrenamiento</h1>
                    <p className="text-text-secondary mt-1 max-w-lg">Completa todos los módulos para obtener tu certificación</p>
                </div>

                <Card className="!p-4 flex items-center gap-6 min-w-[300px] !bg-white/80">
                    <div className="flex-1 space-y-2">
                        <div className="flex justify-between items-end text-sm font-medium">
                            <span className="text-gray-900">Progreso General</span>
                            <span className="text-primary-600 font-bold">{Math.round(progress)}%</span>
                        </div>
                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-1000 ease-out rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="text-xs text-text-secondary text-right">{completedCount} de {totalModules} completados</p>
                    </div>
                </Card>
            </header>

            {modules.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center p-12 text-center bg-white/50 rounded-[32px] border border-dashed border-gray-300">
                    <div className="text-4xl mb-4 opacity-50">📚</div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Sin módulos disponibles</h3>
                    <p className="text-text-secondary">Aún no hay módulos de entrenamiento disponibles. Contacta a tu administrador.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {modules.map((module, index) => {
                        const isLocked = index > 0 && !modules[index - 1].completed;

                        return (
                            <Card
                                key={module.id}
                                className={`!p-0 h-full flex flex-col ${isLocked ? 'opacity-70 grayscale' : 'hover:!scale-[1.02]'}`}
                                glass={!isLocked}
                            >
                                {/* Thumbnail Area */}
                                <div className="aspect-video bg-gray-100 relative overflow-hidden group">
                                    {isLocked ? (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100/80 backdrop-blur-sm z-10 text-gray-500">
                                            <span className="text-3xl mb-2">🔒</span>
                                            <span className="text-xs font-bold uppercase tracking-wider">Bloqueado</span>
                                        </div>
                                    ) : (
                                        <>
                                            <video src={module.videoUrl} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                <div className="w-12 h-12 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                                                    ▶
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {module.completed && (
                                        <div className="absolute top-3 right-3 px-2 py-1 bg-green-500 text-white text-[10px] font-bold rounded-full shadow-sm flex items-center gap-1">
                                            <span>✓</span> Completado
                                        </div>
                                    )}
                                </div>

                                {/* Content Area */}
                                <div className="p-6 flex-1 flex flex-col">
                                    <span className="text-xs font-bold text-primary-600 uppercase tracking-wider mb-2 block">
                                        Módulo {module.order}
                                    </span>
                                    <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight">{module.title}</h3>
                                    <p className="text-sm text-text-secondary line-clamp-2 mb-4 flex-1">{module.description}</p>

                                    {/* Stats / Footer */}
                                    <div className="pt-4 border-t border-gray-100/50 space-y-4">
                                        {module.score !== null && (
                                            <div className="flex items-center justify-between text-xs font-medium">
                                                <span className={`${module.score >= module.passingScore ? 'text-green-600' : 'text-orange-500'}`}>
                                                    Mejor nota: {module.score}%
                                                </span>
                                                <span className="text-text-muted">
                                                    {module.attempts} intento{module.attempts !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        )}

                                        {isLocked ? (
                                            <Button disabled variant="secondary" className="w-full !text-xs !py-3">
                                                Bloqueado
                                            </Button>
                                        ) : (
                                            <Link href={`/modules/${module.id}`} className="block">
                                                <Button className="w-full !text-xs !py-3 shadow-lg shadow-primary-500/20">
                                                    {module.completed ? 'Repasar Módulo' : module.score !== null ? 'Mejorar Nota' : 'Comenzar Módulo'}
                                                </Button>
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
