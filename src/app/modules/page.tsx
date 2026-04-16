'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
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
            // Lanzar las 3 queries en paralelo (eran secuenciales)
            const modulesQuery = query(
                collection(db, 'modules'),
                where('isActive', '==', true),
                orderBy('order', 'asc')
            );
            const quizQuery = query(
                collection(db, 'quiz_sessions'),
                where('userId', '==', user!.uid)
            );

            const [modulesSnapshot, progressDoc, quizSnapshot] = await Promise.all([
                getDocs(modulesQuery),
                getDoc(doc(db, 'users', user!.uid)),
                getDocs(quizQuery),
            ]);

            const modulesData = modulesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Module));
            const userProgress = progressDoc.data()?.progress || {};

            // Filtrar sesiones solo por moduleIds relevantes (Mejora C)
            const moduleIdSet = new Set(modulesData.map(m => m.id));
            const quizSessions = quizSnapshot.docs
                .map(doc => doc.data() as QuizSession)
                .filter(s => moduleIdSet.has(s.moduleId));

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
            <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 lg:py-16 space-y-12 animate-fade-in">
                {/* Skeleton Header */}
                <header className="flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="text-center md:text-left space-y-3">
                        <div className="w-[300px] max-w-[80vw] mx-auto md:mx-0 h-10 bg-surface-dim animate-pulse rounded-2xl" />
                        <div className="w-[380px] max-w-[90vw] mx-auto md:mx-0 h-5 bg-surface-dim animate-pulse rounded-lg" />
                    </div>
                    <div className="w-full md:w-[320px] h-[100px] bg-surface-dim animate-pulse rounded-[2rem]" />
                </header>

                {/* Skeleton Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="card-premium bg-surface-container-lowest h-[400px] rounded-[2rem] overflow-hidden">
                            <div className="w-full aspect-video bg-surface-dim animate-pulse" />
                            <div className="p-8 space-y-5">
                                <div className="w-24 h-4 bg-outline-variant/20 animate-pulse rounded-full" />
                                <div className="w-3/4 h-7 bg-outline-variant/20 animate-pulse rounded-lg" />
                                <div className="w-full h-4 bg-outline-variant/10 animate-pulse rounded-lg" />
                                <div className="w-2/3 h-4 bg-outline-variant/10 animate-pulse rounded-lg" />
                                <div className="pt-6 mt-auto border-t border-outline-variant/15">
                                    <div className="w-full h-12 bg-primary/10 animate-pulse rounded-2xl" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const completedCount = modules.filter(m => m.completed).length;
    const totalModules = modules.length;
    const progress = totalModules > 0 ? (completedCount / totalModules) * 100 : 0;

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 lg:py-16 space-y-12">
            <header className="flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="text-center md:text-left">
                    <h1 className="text-display-lg text-on-surface m-0 mb-2">Módulos de Entrenamiento</h1>
                    <p className="text-body-lg text-secondary max-w-lg m-0">Completa todos los módulos para obtener tu certificación</p>
                </div>

                <Card className="card-premium bg-surface-container-lowest flex items-center gap-6 min-w-full md:min-w-[320px] p-6 rounded-[2rem]">
                    <div className="flex-1 space-y-3">
                        <div className="flex justify-between items-end text-sm font-bold">
                            <span className="text-on-surface">Progreso General</span>
                            <span className="text-primary text-base">{Math.round(progress)}%</span>
                        </div>
                        <div className="h-2.5 w-full bg-surface-dim rounded-full overflow-hidden shadow-inner">
                            <div className="h-full bg-gradient-to-r from-primary to-primary-container transition-all duration-1000 ease-out rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="text-xs font-semibold text-secondary text-right tracking-wide uppercase">{completedCount} de {totalModules} completados</p>
                    </div>
                </Card>
            </header>

            {modules.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center p-16 text-center card-premium bg-surface-container-lowest rounded-[3rem]">
                    <div className="text-6xl mb-6 opacity-40">📚</div>
                    <h3 className="text-display-sm text-on-surface m-0 mb-3">Sin módulos disponibles</h3>
                    <p className="text-body-lg text-secondary max-w-md">Aún no hay módulos de entrenamiento disponibles. Contacta a tu administrador.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {modules.map((module, index) => {
                        const isLocked = index > 0 && !modules[index - 1].completed;

                        return (
                            <Card
                                key={module.id}
                                className={`card-premium bg-surface-container-lowest h-full flex flex-col p-0 overflow-hidden transform transition-all duration-500 rounded-[2rem] ${isLocked ? 'opacity-70 grayscale hover:grayscale-0' : 'hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(17,28,45,0.08)]'}`}
                                glass={false}
                            >
                                {/* Thumbnail Area */}
                                <div className="aspect-video bg-surface-dim relative group">
                                    {isLocked ? (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-dim/80 backdrop-blur-md z-10 text-secondary">
                                            <span className="text-4xl mb-3">🔒</span>
                                            <span className="text-xs font-bold uppercase tracking-widest">Bloqueado</span>
                                        </div>
                                    ) : (
                                        <>
                                            <video src={module.videoUrl} preload="none" onContextMenu={(e) => e.preventDefault()} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-primary/20 group-hover:bg-primary/10 transition-colors flex items-center justify-center">
                                                <div className="w-14 h-14 rounded-full glass-panel flex flex-col items-center justify-center text-primary shadow-lg group-hover:scale-110 transition-transform duration-300">
                                                    <span className="ml-1 text-xl">▶</span>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {module.completed && (
                                        <div className="absolute top-4 right-4 px-3 py-1.5 bg-emerald-500 text-white text-[11px] font-bold tracking-widest uppercase rounded-full shadow-lg flex items-center gap-1.5 border border-emerald-400">
                                            <span>✓</span> Completado
                                        </div>
                                    )}
                                </div>

                                {/* Content Area */}
                                <div className="p-8 flex-1 flex flex-col">
                                    <span className="text-[11px] font-extrabold text-primary uppercase tracking-widest mb-3 block">
                                        Módulo {module.order}
                                    </span>
                                    <h3 className="text-h3 text-on-surface m-0 mb-3">{module.title}</h3>
                                    <p className="text-body-md text-secondary line-clamp-3 mb-6 flex-1">{module.description}</p>

                                    {/* Stats / Footer */}
                                    <div className="pt-6 mt-auto border-t border-outline-variant/15 space-y-5">
                                        {module.score !== null && (
                                            <div className="flex items-center justify-between text-sm font-bold">
                                                <span className={`${module.score >= module.passingScore ? 'text-emerald-600' : 'text-orange-500'}`}>
                                                    Mejor nota: {module.score}%
                                                </span>
                                                <span className="text-secondary/80">
                                                    {module.attempts} intento{module.attempts !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        )}

                                        {isLocked ? (
                                            <Button disabled variant="tertiary" className="w-full py-4 text-sm tracking-wide">
                                                Bloqueado
                                            </Button>
                                        ) : (
                                            <Link href={`/modules/${module.id}`} className="block w-full">
                                                <Button className="w-full py-4 text-sm" variant={module.completed ? 'secondary' : 'primary'}>
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
