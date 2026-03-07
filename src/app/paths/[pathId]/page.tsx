'use client';

import { useEffect, useState, use } from 'react';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Course, LearningPath, Module } from '@/types';
import { FIXED_PATHS } from '@/lib/constants';
import Link from 'next/link';
import styles from './page.module.css';
import Breadcrumbs from '@/components/Breadcrumbs';
import {
    Lock,
    PlayCircle,
    CheckCircle,
    ChevronRight,
    ArrowLeft,
    Clock,
    Award
} from 'lucide-react';

interface CourseWithProgress extends Course {
    totalModules: number;
    completedModules: number;
    progress: number;
    isLocked: boolean;
    nextModuleId: string | null; // ID del primer módulo pendiente (o el primero si todos completados)
}

export default function PathDetailsPage({ params }: { params: Promise<{ pathId: string }> }) {
    const { pathId } = use(params);
    const { user } = useAuth();

    const [path, setPath] = useState<LearningPath | null>(null);
    const [courses, setCourses] = useState<CourseWithProgress[]>([]);
    const [loading, setLoading] = useState(true);
    const [userProgress, setUserProgress] = useState<Record<string, any>>({});

    useEffect(() => {
        if (user && pathId) {
            loadPathData();
        }
    }, [user, pathId]);

    const loadPathData = async () => {
        try {
            // Lanzar queries independientes en paralelo: path + cursos + sesiones
            // (los módulos deben esperar los courseIds de cursos — waterfall inevitable)
            const coursesQ = query(
                collection(db, 'courses'),
                where('pathId', '==', pathId),
                where('isActive', '==', true),
                orderBy('order', 'asc')
            );
            const sessionsQ = query(
                collection(db, 'quiz_sessions'),
                where('userId', '==', user?.uid),
                where('passed', '==', true)
            );

            const [pathDoc, coursesSnapshot, sessionsSnapshot, userDocSnap] = await Promise.all([
                getDoc(doc(db, 'learning_paths', pathId)),
                getDocs(coursesQ),
                getDocs(sessionsQ),
                user ? getDoc(doc(db, 'users', user.uid)) : Promise.resolve(null),
            ]);

            const progress = userDocSnap?.exists() ? (userDocSnap.data()?.progress || {}) : {};
            setUserProgress(progress);

            // Resolver path
            if (!pathDoc.exists()) {
                const fixedPath = FIXED_PATHS.find(p => p.id === pathId);
                if (!fixedPath) { setLoading(false); return; }
                setPath(fixedPath);
            } else {
                setPath({ id: pathDoc.id, ...pathDoc.data() } as LearningPath);
            }

            const coursesData = coursesSnapshot.docs.map(c => ({ id: c.id, ...c.data() } as Course));
            const passedModuleIds = new Set(sessionsSnapshot.docs.map(s => s.data().moduleId));

            // Módulos: dependen de courseIds (segunda ronda necesaria)
            const courseIds = coursesData.map(c => c.id);
            let allModules: Module[] = [];
            if (courseIds.length > 0) {
                const modulesQ = query(
                    collection(db, 'modules'),
                    where('courseId', 'in', courseIds),
                    where('isActive', '==', true)
                );
                const modulesSnapshot = await getDocs(modulesQ);
                allModules = modulesSnapshot.docs.map(m => ({ id: m.id, ...m.data() } as Module));
            }

            // 5. Calcular progreso y bloqueos
            let previousCourseCompleted = true;

            const coursesWithProgress = coursesData.map(course => {
                const courseModules = allModules
                    .filter(m => m.courseId === course.id)
                    .sort((a, b) => a.order - b.order);
                const totalModules = courseModules.length;
                const completedModules = courseModules.filter(m => passedModuleIds.has(m.id)).length;
                const courseProgress = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

                const isLocked = !previousCourseCompleted && course.order > 1 && !course.isOptional;
                const isCompleted = courseProgress === 100;

                if (!isCompleted && !course.isOptional) {
                    previousCourseCompleted = false;
                }

                // Calcular primer módulo pendiente (para link directo, evita /courses/[id] redirect)
                const nextPendingModule = courseModules.find(m => !progress[m.id]?.completed);
                const nextModuleId = nextPendingModule?.id || courseModules[0]?.id || null;

                return {
                    ...course,
                    totalModules,
                    completedModules,
                    progress: courseProgress,
                    isLocked,
                    nextModuleId,
                };
            });

            setCourses(coursesWithProgress);

        } catch (error) {
            console.error('Error loading path details:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className={styles.pageContainer}>
                <div className={styles.contentGrid}>
                    {/* Skeleton Sidebar */}
                    <aside className={styles.sidebar}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <div className="sk" style={{ width: '180px', height: '14px' }} />
                        </div>
                        <div className={styles.heroCard}>
                            <div className="sk" style={{ width: '88px', height: '88px', borderRadius: '24px', marginBottom: '1.5rem' }} />
                            <div className="sk" style={{ width: '70%', height: '28px', marginBottom: '0.75rem' }} />
                            <div className="sk" style={{ width: '100%', height: '14px', marginBottom: '0.5rem' }} />
                            <div className="sk" style={{ width: '85%', height: '14px', marginBottom: '2rem' }} />
                            <div className={styles.statsRow}>
                                {[1, 2, 3].map(i => (
                                    <div key={i} className={styles.statItem}>
                                        <div className="sk" style={{ width: '32px', height: '24px', marginBottom: '0.25rem' }} />
                                        <div className="sk" style={{ width: '52px', height: '10px' }} />
                                    </div>
                                ))}
                            </div>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                    <div className="sk" style={{ width: '120px', height: '14px' }} />
                                    <div className="sk" style={{ width: '36px', height: '14px' }} />
                                </div>
                                <div className="sk" style={{ width: '100%', height: '12px', borderRadius: '99px' }} />
                            </div>
                        </div>
                    </aside>

                    {/* Skeleton Main Content */}
                    <main className={styles.mainContent}>
                        <div className={styles.sectionHeader}>
                            <div className="sk" style={{ width: '260px', height: '24px', marginBottom: '0.5rem' }} />
                            <div className="sk" style={{ width: '340px', height: '14px', marginLeft: '2.25rem' }} />
                        </div>
                        <div className={styles.timeline}>
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className={styles.timelineItem} style={{ opacity: 1, animation: 'none' }}>
                                    <div className={styles.timelineDot} />
                                    <div className={styles.courseCard} style={{ cursor: 'default' }}>
                                        <div className={styles.cardContent}>
                                            <div className="sk" style={{ width: '64px', height: '64px', borderRadius: '20px', flexShrink: 0 }} />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                    <div className="sk" style={{ width: '80px', height: '16px' }} />
                                                    <div className="sk" style={{ width: '100px', height: '14px' }} />
                                                </div>
                                                <div className="sk" style={{ width: '75%', height: '20px', marginBottom: '0.5rem' }} />
                                                <div className="sk" style={{ width: '100%', height: '14px', marginBottom: '0.25rem' }} />
                                                <div className="sk" style={{ width: '60%', height: '14px' }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    if (!path) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-center p-6 bg-[#f8fafc]">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Ruta no encontrada</h2>
                <Link href="/dashboard" className="text-indigo-600 hover:underline">
                    Volver al Dashboard
                </Link>
            </div>
        );
    }

    // Calcular progreso total del path
    const totalModulesInPath = courses.reduce((acc, c) => acc + c.totalModules, 0);
    const completedModulesInPath = courses.reduce((acc, c) => acc + c.completedModules, 0);
    const pathProgress = totalModulesInPath > 0 ? Math.round((completedModulesInPath / totalModulesInPath) * 100) : 0;

    return (
        <div className={styles.pageContainer}>
            <div className={styles.contentGrid}>
                {/* Left Column: Sticky Sidebar / Overview */}
                <aside className={styles.sidebar}>
                    <Breadcrumbs items={[
                        { label: 'Dashboard', href: '/dashboard', emoji: '🏠' },
                        { label: path.title, emoji: path.icon || '🎓' },
                    ]} />

                    <div className={styles.heroCard}>
                        <div className={styles.heroIconWrapper}>
                            <span>{path.icon || '🎓'}</span>
                        </div>
                        <h1 className={styles.heroTitle}>{path.title}</h1>
                        <p className={styles.heroDescription}>{path.description}</p>

                        <div className={styles.statsRow}>
                            <div className={styles.statItem}>
                                <span className={styles.statValue}>{courses.length}</span>
                                <span className={styles.statLabel}>Cursos</span>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statValue}>{totalModulesInPath}</span>
                                <span className={styles.statLabel}>Módulos</span>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statValue}>{completedModulesInPath}</span>
                                <span className={styles.statLabel}>Completados</span>
                            </div>
                        </div>

                        <div className={styles.mainProgress}>
                            <div className={styles.progressLabel}>
                                <span>Progreso General</span>
                                <span className="text-indigo-600">{pathProgress}%</span>
                            </div>
                            <div className={styles.progressBar}>
                                <div
                                    className={styles.progressFill}
                                    style={{ width: `${pathProgress}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Right Column: Path Journey */}
                <main className={styles.mainContent}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>
                            <Award size={24} className="text-indigo-600" />
                            Tu Viaje de Aprendizaje
                        </h2>
                        <p className={styles.sectionSubtitle}>Sigue la ruta y desbloquea nuevos conocimientos paso a paso.</p>
                    </div>

                    <div className={styles.timeline}>
                        {courses.map((course, index) => {
                            const isCompleted = course.progress === 100;
                            const isLocked = course.isLocked;
                            // Determine visual state
                            // Active means it's the current one being worked on (not completed, but not locked)
                            // OR it's the first available one.
                            const isActive = !isLocked && !isCompleted;

                            return (
                                <div
                                    key={course.id}
                                    className={`${styles.timelineItem} ${isCompleted ? styles.completed : ''} ${isActive ? styles.active : ''}`}
                                >
                                    <div className={styles.timelineDot}>
                                        {isCompleted && <CheckCircle size={14} className="text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" strokeWidth={3} />}
                                    </div>

                                    <Link
                                        href={isLocked || !course.nextModuleId ? '#' : `/modules/${course.nextModuleId}`}
                                        className={`${styles.courseCard} ${isLocked ? styles.locked : ''}`}
                                        aria-disabled={isLocked}
                                    >
                                        <div className={styles.cardContent}>
                                            <div className={styles.cardIcon}>
                                                {isLocked ? <Lock size={24} /> : isCompleted ? <CheckCircle size={24} /> : <PlayCircle size={24} />}
                                            </div>

                                            <div className={styles.cardInfo}>
                                                <div className={styles.cardHeader}>
                                                    <span className={styles.orderBadge}>Curso {course.order}</span>
                                                    <span className={styles.progressText}>
                                                        {course.completedModules}/{course.totalModules} Módulos
                                                    </span>
                                                </div>
                                                <h3 className={styles.cardTitle}>{course.title}</h3>
                                                <p className={styles.cardDescription}>{course.description}</p>
                                            </div>

                                            {!isLocked && (
                                                <div className={styles.actionArea}>
                                                    <ChevronRight size={24} />
                                                </div>
                                            )}
                                        </div>
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                </main>
            </div>
        </div>
    );
}
