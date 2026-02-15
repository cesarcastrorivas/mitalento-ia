'use client';

import { useEffect, useState, use } from 'react';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Module, QuizSession, Course } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import styles from './page.module.css';
import Breadcrumbs from '@/components/Breadcrumbs';
import LoadingScreen from '@/components/LoadingScreen';
import {
    PlayCircle,
    CheckCircle,
    Lock,
    RotateCcw,
    Trophy,
    Video,
    ArrowLeft
} from 'lucide-react';

interface ModuleWithProgress extends Module {
    completed: boolean;
    score: number | null;
    attempts: number;
}

export default function CourseModulesPage({ params }: { params: Promise<{ courseId: string }> }) {
    const { courseId } = use(params);
    const { user } = useAuth();

    const [course, setCourse] = useState<Course | null>(null);
    const [modules, setModules] = useState<ModuleWithProgress[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user && courseId) {
            loadData();
        }
    }, [user, courseId]);

    const loadData = async () => {
        try {
            // 1. Cargar Curso
            const courseDoc = await getDoc(doc(db, 'courses', courseId));
            if (!courseDoc.exists()) {
                setLoading(false);
                return;
            }
            setCourse({ id: courseDoc.id, ...courseDoc.data() } as Course);

            // 2. Cargar Módulos del Curso
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

            // 3. Cargar progreso del usuario (Completed flags)
            const userDoc = await getDoc(doc(db, 'users', user!.uid));
            const userProgress = userDoc.data()?.progress || {};

            // 4. Cargar sesiones de quiz
            const quizQuery = query(
                collection(db, 'quiz_sessions'),
                where('userId', '==', user!.uid)
            );
            const quizSnapshot = await getDocs(quizQuery);
            const quizSessions = quizSnapshot.docs.map(doc => doc.data() as QuizSession);

            // 5. Combinar
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
        } catch (error) {
            console.error('Error loading course modules:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <LoadingScreen message="Cargando módulos del curso..." />;

    if (!course) return (
        <div className="flex flex-col items-center justify-center min-h-screen text-center p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Curso no encontrado</h2>
            <Link href="/dashboard" className="text-indigo-600 hover:underline">
                Volver al Dashboard
            </Link>
        </div>
    );

    const completedCount = modules.filter(m => m.completed).length;
    const progress = modules.length > 0 ? (completedCount / modules.length) * 100 : 0;

    const nextModule = modules.find(m => !m.completed) || modules[0];

    return (
        <div className={styles.page}>
            <div className="px-8 pt-4">
                <Breadcrumbs items={[
                    { label: 'Dashboard', href: '/dashboard', emoji: '🏠' },
                    { label: 'Ruta', href: `/paths/${course.pathId}`, emoji: '📚' },
                    { label: course.title },
                ]} />
            </div>

            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <h1>{course.title}</h1>
                    <p className={styles.heroDescription}>{course.description}</p>

                    {nextModule && (
                        <div className="mt-6">
                            <Link href={`/modules/${nextModule.id}`}>
                                <button className="px-8 py-3 bg-white text-indigo-600 font-bold rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2">
                                    <PlayCircle size={24} fill="currentColor" />
                                    {modules.some(m => m.completed) ? 'Continuar Aprendizaje' : 'Comenzar Curso'}
                                </button>
                            </Link>
                        </div>
                    )}
                </div>
                <div className={styles.progressCard}>
                    <div className={styles.progressHeader}>
                        <span>Tu Progreso</span>
                        <span className={styles.progressPercent}>{Math.round(progress)}%</span>
                    </div>
                    <div className={styles.progressBarContainer}>
                        <div
                            className={styles.progressBarFill}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className={styles.progressStats}>
                        {completedCount} de {modules.length} módulos completados
                    </div>
                </div>
            </header>

            <div className={styles.modulesGrid}>
                {modules.map((module, index) => {
                    const isLocked = index > 0 && !modules[index - 1].completed;

                    return (
                        <div
                            key={module.id}
                            className={`${styles.moduleCard} ${module.completed ? styles.completed : ''} ${isLocked ? styles.locked : ''}`}
                        >
                            <div className={styles.modulePreview}>
                                {isLocked && (
                                    <div className={styles.lockedOverlay}>
                                        <Lock size={32} />
                                        <p>Completa el anterior</p>
                                    </div>
                                )}

                                {module.completed && (
                                    <div className={styles.completedBadge}>
                                        <CheckCircle size={14} /> completado
                                    </div>
                                )}

                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent z-0"></div>
                                <div className={styles.previewGradient} style={{
                                    background: [
                                        'linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%)',
                                        'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
                                        'linear-gradient(135deg, #6366F1 0%, #10B981 100%)',
                                        'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
                                        'linear-gradient(135deg, #14B8A6 0%, #3B82F6 100%)',
                                        'linear-gradient(135deg, #8B5CF6 0%, #F97316 100%)',
                                    ][index % 6]
                                }} />
                                <Video className={styles.previewIcon} />
                            </div>

                            <div className={styles.moduleContent}>
                                <div className={styles.moduleHeader}>
                                    <h3 className={styles.moduleTitle}>{module.title}</h3>
                                </div>

                                <p className={styles.moduleDescription}>{module.description}</p>

                                {module.score !== null && (
                                    <div className={styles.scoreInfo}>
                                        <div className="flex items-center gap-2">
                                            <Trophy size={16} className={module.score >= (module.passingScore || 70) ? "text-yellow-500" : "text-gray-400"} />
                                            <span className={styles.scoreLabel}>Tu Calificación:</span>
                                        </div>
                                        <span className={`${styles.scoreValue} ${module.score >= (module.passingScore || 70) ? styles.passed : styles.failed}`}>
                                            {module.score}%
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className={styles.moduleFooter}>
                                {isLocked ? (
                                    <button className={`${styles.actionBtn} ${styles.btnLocked}`} disabled>
                                        <Lock size={18} /> Bloqueado
                                    </button>
                                ) : (
                                    <Link href={`/modules/${module.id}`} className="w-full">
                                        <div className={`${styles.actionBtn} ${module.completed ? styles.btnSecondary : styles.btnPrimary}`}>
                                            {module.completed ? (
                                                <>
                                                    <RotateCcw size={18} /> Repasar Módulo
                                                </>
                                            ) : module.score !== null ? (
                                                <>
                                                    <RotateCcw size={18} /> Reintentar Quiz
                                                </>
                                            ) : (
                                                <>
                                                    <PlayCircle size={18} /> Comenzar Lección
                                                </>
                                            )}
                                        </div>
                                    </Link>
                                )}
                            </div>
                        </div>
                    );
                })}

                {modules.length === 0 && (
                    <div className="col-span-full text-center py-12 text-gray-500 bg-gray-50 rounded-xl border-dashed border-2 border-gray-200">
                        <Video size={48} className="mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">Este curso aún no tiene módulos publicados.</p>
                        <p className="text-sm">Vuelve pronto para ver contenido nuevo.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
