'use client';

import { useEffect, useState, use } from 'react';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Course, LearningPath, Module } from '@/types';
import { FIXED_PATHS } from '@/lib/constants';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import {
    Lock,
    PlayCircle,
    CheckCircle,
    ChevronRight,
    ArrowLeft,
    Clock,
    Award,
    Building2,
    LineChart,
    Crown,
    GraduationCap,
    BookOpen,
    Home
} from 'lucide-react';

const EMOJI_TO_ICON: Record<string, any> = {
    '🏢': Building2,
    '📈': LineChart,
    '👑': Crown,
    '🎓': GraduationCap,
};

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

            if (!pathDoc.exists()) {
                const fixedPath = FIXED_PATHS.find(p => p.id === pathId);
                if (!fixedPath) { setLoading(false); return; }
                setPath(fixedPath);
            } else {
                setPath({ id: pathDoc.id, ...pathDoc.data() } as LearningPath);
            }

            const coursesData = coursesSnapshot.docs.map(c => ({ id: c.id, ...c.data() } as Course));
            const passedModuleIds = new Set(sessionsSnapshot.docs.map(s => s.data().moduleId));

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
            <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 pb-24 font-sans flex flex-col lg:flex-row gap-8 lg:gap-12 scroll-smooth">
                {/* Skeleton Sidebar */}
                <aside className="w-full lg:w-80 flex-shrink-0 animate-pulse">
                    <div className="h-4 bg-outline-variant/20 rounded w-1/2 mb-6" />
                    <div className="card-premium bg-surface-container-lowest border border-outline-variant/10 p-8 hidden lg:block">
                        <div className="w-20 h-20 rounded-[1.25rem] bg-surface-dim mb-6" />
                        <div className="h-6 bg-outline-variant/20 rounded w-3/4 mb-4" />
                        <div className="h-4 bg-outline-variant/20 rounded w-full mb-2" />
                        <div className="h-4 bg-outline-variant/20 rounded w-5/6 mb-8" />
                        <div className="flex gap-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex flex-col gap-2">
                                    <div className="w-8 h-6 bg-outline-variant/20 rounded" />
                                    <div className="w-12 h-3 bg-outline-variant/20 rounded" />
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* Skeleton Main Content */}
                <main className="flex-1 min-w-0 animate-pulse">
                    <div className="flex items-center gap-3 border-b border-outline-variant/10 pb-6 mb-8">
                        <div className="w-8 h-8 rounded-full bg-outline-variant/20" />
                        <div className="h-6 bg-outline-variant/20 rounded w-48" />
                    </div>
                    
                    <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-outline-variant/10 before:to-transparent">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-surface bg-surface-dim shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 text-outline-variant/50 z-10">
                                </div>
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-outline-variant/10 bg-surface-container-lowest shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="h-4 bg-outline-variant/20 rounded w-16" />
                                        <div className="h-4 bg-outline-variant/20 rounded w-20" />
                                    </div>
                                    <div className="h-5 bg-outline-variant/20 rounded w-3/4 mb-2" />
                                    <div className="h-4 bg-outline-variant/20 rounded w-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                </main>
            </div>
        );
    }

    if (!path) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-surface font-sans">
                <div className="w-20 h-20 rounded-[1.25rem] bg-surface-dim flex items-center justify-center text-outline-variant mb-6 shadow-sm">
                    <BookOpen size={32} strokeWidth={1.5} />
                </div>
                <h2 className="text-display-sm text-on-surface mb-3">Ruta no encontrada</h2>
                <Link href="/dashboard" className="text-primary hover:text-primary-container font-medium text-body-lg underline underline-offset-4 decoration-primary/30 transition-colors">
                    Volver al Dashboard
                </Link>
            </div>
        );
    }

    const totalModulesInPath = courses.reduce((acc, c) => acc + c.totalModules, 0);
    const completedModulesInPath = courses.reduce((acc, c) => acc + c.completedModules, 0);
    const pathProgress = totalModulesInPath > 0 ? Math.round((completedModulesInPath / totalModulesInPath) * 100) : 0;

    return (
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 pb-24 font-sans flex flex-col lg:flex-row gap-8 lg:gap-12 scroll-smooth">
            
            {/* Left Column: Sticky Sidebar / Overview */}
            <aside className="w-full lg:w-[360px] flex-shrink-0 animate-fade-in-up">
                <div className="mb-6 lg:mb-8 text-label-md">
                    <Breadcrumbs items={[
                        { label: 'Dashboard', href: '/dashboard', icon: <Home size={14} className="text-secondary" /> },
                        { label: path.title, icon: (() => {
                            const IconComponent = EMOJI_TO_ICON[path.icon || ''] || BookOpen;
                            return <IconComponent size={14} className="text-primary" />;
                        })() },
                    ]} />
                </div>

                <div className="card-premium bg-surface-container-lowest border border-outline-variant/10 p-8 sm:p-10 lg:sticky lg:top-[5.5rem] relative overflow-hidden ring-1 ring-inset ring-surface-dim/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)] transition-shadow duration-500">
                    {/* Decorative blurred background */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[80px] -z-10 -translate-y-1/2 translate-x-1/2 pointer-events-none rounded-full" />
                    
                    <div className="w-20 h-20 rounded-[1.5rem] bg-surface-dim text-primary flex items-center justify-center mb-8 border border-white shadow-sm transition-transform duration-500 hover:scale-105 hover:bg-primary/5">
                        {(() => {
                            const IconComponent = EMOJI_TO_ICON[path.icon || ''] || BookOpen;
                            return <IconComponent size={36} strokeWidth={1.5} />;
                        })()}
                    </div>
                    
                    <h1 className="text-display-sm text-on-surface mb-4 leading-tight">{path.title}</h1>
                    <p className="text-body-lg text-secondary mb-10 leading-relaxed font-light">{path.description}</p>

                    <div className="grid grid-cols-3 gap-4 mb-10 py-6 border-y border-outline-variant/10 text-center">
                        <div>
                            <span className="block text-2xl font-extrabold text-on-surface mb-1">{courses.length}</span>
                            <span className="text-[11px] font-bold text-outline-variant uppercase tracking-widest leading-tight block">Cursos</span>
                        </div>
                        <div>
                            <span className="block text-2xl font-extrabold text-on-surface mb-1">{totalModulesInPath}</span>
                            <span className="text-[11px] font-bold text-outline-variant uppercase tracking-widest leading-tight block">Módulos</span>
                        </div>
                        <div>
                            <span className="block text-2xl font-extrabold text-emerald-600 mb-1">{completedModulesInPath}</span>
                            <span className="text-[11px] font-bold text-outline-variant uppercase tracking-widest leading-tight block">Logrados</span>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-label-md font-bold text-on-surface uppercase tracking-wider">Progreso</span>
                            <span className="text-headline-sm text-primary font-bold">{pathProgress}%</span>
                        </div>
                        <div className="h-2 w-full bg-surface-dim rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all duration-1000 ease-out rounded-full"
                                style={{ width: `${pathProgress}%` }}
                            />
                        </div>
                    </div>
                </div>
            </aside>

            {/* Right Column: Path Journey */}
            <main className="flex-1 min-w-0 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                <div className="flex items-end gap-5 border-b border-outline-variant/10 pb-6 mb-12">
                    <div className="w-12 h-12 rounded-[1rem] bg-secondary-container/30 text-secondary flex items-center justify-center flex-shrink-0">
                        <Award size={24} strokeWidth={1.5} />
                    </div>
                    <div>
                        <h2 className="text-headline-md text-on-surface leading-tight mb-1">
                            Tu Viaje de Aprendizaje
                        </h2>
                        <p className="text-body-md text-outline-variant">Sigue la ruta y domina nuevos conocimientos paso a paso.</p>
                    </div>
                </div>

                {/* Timeline UI via Tailwind based on "cruip" or vertical line styling */}
                <div className="relative space-y-6 lg:space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-outline-variant/10 before:via-outline-variant/20 before:to-transparent">
                    {courses.map((course, index) => {
                        const isCompleted = course.progress === 100;
                        const isLocked = course.isLocked;
                        const isActive = !isLocked && !isCompleted;

                        let dotColors = "border-surface bg-surface-dim text-outline-variant/50";
                        if (isCompleted) dotColors = "border-surface bg-emerald-500 text-white shadow-[0_0_0_4px_rgba(16,185,129,0.15)]";
                        if (isActive) dotColors = "border-surface bg-primary text-white shadow-[0_0_0_4px_rgba(71,30,82,0.15)] ring-4 ring-primary/20"; // Adding extra glow

                        return (
                            <div
                                key={course.id}
                                className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group ${isActive ? 'is-active' : ''}`}
                            >
                                {/* Timeline Dot */}
                                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 shrink-0 z-10 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 transition-colors duration-300 ${dotColors}`}>
                                    {isCompleted ? <CheckCircle size={14} strokeWidth={3} /> : <span className="text-xs font-bold">{course.order}</span>}
                                </div>

                                {/* Timeline Card */}
                                <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] focus-within:ring-4 ring-primary/20 rounded-[1.5rem] transition-all duration-300 ${isLocked ? 'opacity-60 grayscale-[0.3]' : 'hover:-translate-y-1'}`}>
                                    <Link
                                        href={isLocked || !course.nextModuleId ? '#' : `/modules/${course.nextModuleId}`}
                                        className={`card-premium block bg-surface-container-lowest border ${isActive ? 'border-primary/30 shadow-[0_8px_30px_rgb(71,30,82,0.08)]' : 'border-outline-variant/10 hover:border-primary/20'} p-6 sm:p-8 outline-none rounded-[1.5rem]`}
                                        aria-disabled={isLocked}
                                        tabIndex={isLocked ? -1 : 0}
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
                                            <div className="flex-shrink-0">
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
                                                    isCompleted ? 'bg-emerald-500/10 text-emerald-600' :
                                                    isActive ? 'bg-primary-container/40 text-primary' :
                                                    'bg-surface-dim text-outline-variant'
                                                }`}>
                                                    {isLocked ? <Lock size={26} strokeWidth={1.5} /> : isCompleted ? <CheckCircle size={26} strokeWidth={1.5} /> : <PlayCircle size={26} strokeWidth={1.5} />}
                                                </div>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-[10px] font-bold uppercase tracking-widest">
                                                    <span className={`${isActive ? 'text-primary' : 'text-secondary'}`}>Curso {course.order}</span>
                                                    <span className="text-outline-variant bg-surface-dim px-2 py-0.5 rounded-full border border-outline-variant/5 whitespace-nowrap">
                                                        {course.completedModules} / {course.totalModules} Módulos
                                                    </span>
                                                </div>
                                                <h3 className={`text-headline-sm mb-2 ${isActive ? 'text-primary' : 'text-on-surface'} transition-colors leading-tight`}>
                                                    {course.title}
                                                </h3>
                                                <p className="text-body-md text-secondary leading-relaxed line-clamp-3 mb-5">
                                                    {course.description}
                                                </p>
                                                
                                                {/* Progress Indicator inside card */}
                                                {!isLocked && (
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex-1 h-1.5 bg-surface-dim rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full rounded-full transition-all duration-1000 ${isCompleted ? 'bg-emerald-500' : 'bg-primary'}`}
                                                                style={{ width: `${course.progress}%` }}
                                                            />
                                                        </div>
                                                        <span className={`text-xs font-bold ${isCompleted ? 'text-emerald-600' : 'text-primary'}`}>{course.progress}%</span>
                                                    </div>
                                                )}
                                            </div>

                                            {!isLocked && (
                                                <div className="hidden sm:flex self-center w-10 h-10 rounded-full bg-surface-container-lowest border border-outline-variant/10 items-center justify-center text-outline-variant group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all duration-300 ml-2">
                                                    <ChevronRight size={20} strokeWidth={2} />
                                                </div>
                                            )}
                                        </div>
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>
        </div>
    );
}

