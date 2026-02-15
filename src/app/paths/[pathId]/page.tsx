'use client';

import { useEffect, useState, use } from 'react';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Course, LearningPath, Module } from '@/types';
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
}

export default function PathDetailsPage({ params }: { params: Promise<{ pathId: string }> }) {
    const { pathId } = use(params);
    const { user } = useAuth();

    const [path, setPath] = useState<LearningPath | null>(null);
    const [courses, setCourses] = useState<CourseWithProgress[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user && pathId) {
            loadPathData();
        }
    }, [user, pathId]);

    const loadPathData = async () => {
        try {
            // 1. Cargar Path
            const pathDoc = await getDoc(doc(db, 'learning_paths', pathId));
            if (!pathDoc.exists()) {
                setLoading(false);
                return;
            }
            setPath({ id: pathDoc.id, ...pathDoc.data() } as LearningPath);

            // 2. Cargar Cursos del Path
            const coursesQ = query(
                collection(db, 'courses'),
                where('pathId', '==', pathId),
                where('isActive', '==', true),
                orderBy('order', 'asc')
            );
            const coursesSnapshot = await getDocs(coursesQ);
            const coursesData = coursesSnapshot.docs.map(c => ({ id: c.id, ...c.data() } as Course));

            // 3. Cargar Módulos
            const modulesQ = query(collection(db, 'modules'), where('isActive', '==', true));
            const modulesSnapshot = await getDocs(modulesQ);
            const allModules = modulesSnapshot.docs.map(m => ({ id: m.id, ...m.data() } as Module));

            // 4. Cargar Progreso
            const sessionsQ = query(
                collection(db, 'quiz_sessions'),
                where('userId', '==', user?.uid),
                where('passed', '==', true)
            );
            const sessionsSnapshot = await getDocs(sessionsQ);
            const passedModuleIds = new Set(sessionsSnapshot.docs.map(s => s.data().moduleId));

            // 5. Calcular progreso y bloqueos
            let previousCourseCompleted = true;

            const coursesWithProgress = coursesData.map(course => {
                const courseModules = allModules.filter(m => m.courseId === course.id);
                const totalModules = courseModules.length;
                const completedModules = courseModules.filter(m => passedModuleIds.has(m.id)).length;
                const progress = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

                const isLocked = !previousCourseCompleted && course.order > 1 && !course.isOptional;
                const isCompleted = progress === 100;

                if (!isCompleted && !course.isOptional) {
                    previousCourseCompleted = false;
                }

                return {
                    ...course,
                    totalModules,
                    completedModules,
                    progress,
                    isLocked: false // Forzamos desbloqueo por ahora para UX de demo
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
            <div className="flex items-center justify-center min-h-screen bg-[#f8fafc]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
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
                                        href={isLocked ? '#' : `/courses/${course.id}`}
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
