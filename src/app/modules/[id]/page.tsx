'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, query, where, orderBy, getDocs, Timestamp, collection, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Module } from '@/types';
import { checkCascadeCompletion } from '@/lib/grading-utils';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, ChevronRight, CheckCircle, Lock, AlertCircle, Trophy, Clock, PlayCircle, Menu, X, Info, Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import LoadingScreen from '@/components/LoadingScreen';
import Toast, { ToastType } from '@/components/Toast';
import dynamic from 'next/dynamic';

const QuizModal = dynamic(() => import('@/components/modules/QuizModal'), {
    ssr: false,
    loading: () => (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/60 backdrop-blur-sm">
            <div className="bg-surface-container-lowest rounded-[2rem] p-10 flex flex-col items-center gap-6 shadow-[0_20px_40px_rgba(17,28,45,0.08)]">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-[10px] text-secondary uppercase tracking-widest font-bold">Cargando evaluación...</p>
            </div>
        </div>
    ),
});

export default function ModulePage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const videoRef = useRef<HTMLVideoElement>(null);
    const lastWatchedRef = useRef(0);
    const maxTimeRef = useRef(0);
    const autoCompletedRef = useRef(false);
    const moduleId = params.id as string;

    const [module, setModule] = useState<Module | null>(null);
    const [loading, setLoading] = useState(true);

    const [infoOpen, setInfoOpen] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [watchedPercentage, setWatchedPercentage] = useState(0);
    const [canTakeQuiz, setCanTakeQuiz] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [showQuizModal, setShowQuizModal] = useState(false);

    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [videoCurrentTime, setVideoCurrentTime] = useState(0);
    const [videoDuration, setVideoDuration] = useState(0);
    const videoContainerRef = useRef<HTMLDivElement>(null);

    const [courseModules, setCourseModules] = useState<Module[]>([]);
    const [userProgress, setUserProgress] = useState<Record<string, any>>({});
    const [courseTitle, setCourseTitle] = useState('');
    const [coursePathId, setCoursePathId] = useState<string | null>(null);
    const [videoSrc, setVideoSrc] = useState<string>('');

    useEffect(() => {
        if (!module || !module.videoUrl) return;
        // Preview mode uses mock URL directly
        if (module.id === 'preview') {
            setVideoSrc(module.videoUrl);
            return;
        }
        let cancelled = false;
        fetch('/api/video-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ moduleId: module.id }),
        })
            .then(res => res.json())
            .then(data => {
                if (!cancelled && data.url) setVideoSrc(data.url);
            })
            .catch(() => {
                // Fallback to direct URL if signed URL fails
                if (!cancelled) setVideoSrc(module.videoUrl);
            });
        return () => { cancelled = true; };
    }, [module]);

    useEffect(() => {
        autoCompletedRef.current = false;
        loadModuleData();

        let scrollTicking = false;
        const handleScroll = () => {
            if (!scrollTicking) {
                requestAnimationFrame(() => {
                    setScrolled(window.scrollY > 20);
                    scrollTicking = false;
                });
                scrollTicking = true;
            }
        };
        window.addEventListener('scroll', handleScroll, { passive: true });

        // Auto-open info only on large screens, close on mobile/tablet
        setInfoOpen(window.innerWidth > 1200);
        setSidebarOpen(window.innerWidth > 1024);

        return () => window.removeEventListener('scroll', handleScroll);
    }, [moduleId, user]);

    const loadModuleData = async () => {
        if (moduleId === 'preview') {
            const mockModule: Module = {
                id: 'preview',
                courseId: 'mock-course',
                title: 'Introducción al Liderazgo Efectivo',
                description: 'Aprende los fundamentos del liderazgo moderno y cómo inspirar a tu equipo para alcanzar resultados extraordinarios.',
                videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                order: 1,
                isActive: true,
                passingScore: 80,
                requiredWatchPercentage: 90,
                transcription: 'Transcripción de ejemplo...',
                createdAt: Timestamp.now(),
                createdBy: 'mock-admin',
            };
            setModule(mockModule);
            setCourseTitle('Curso de Liderazgo Avanzado');

            const mockModules: Module[] = [
                mockModule,
                { ...mockModule, id: '2', title: 'Comunicación Asertiva', order: 2, videoUrl: '' },
                { ...mockModule, id: '3', title: 'Resolución de Conflictos', order: 3, videoUrl: '' },
                { ...mockModule, id: '4', title: 'Gestión del Tiempo', order: 4, videoUrl: '' },
                { ...mockModule, id: '5', title: 'Inteligencia Emocional', order: 5, videoUrl: '' },
            ];
            setCourseModules(mockModules);

            setUserProgress({
                'preview': { completed: false, score: 0 },
                '2': { completed: false, score: 0 }
            });

            setLoading(false);
            return;
        }

        try {
            const [moduleDoc, userDocSnap] = await Promise.all([
                getDoc(doc(db, 'modules', moduleId)),
                user ? getDoc(doc(db, 'users', user.uid)) : Promise.resolve(null),
            ]);

            if (!moduleDoc.exists()) {
                router.push('/dashboard');
                return;
            }
            const currentModuleData = { id: moduleDoc.id, ...moduleDoc.data() } as Module;
            setModule(currentModuleData);

            if (userDocSnap?.exists()) {
                setUserProgress(userDocSnap.data()?.progress || {});
            }

            if (currentModuleData.courseTitle) setCourseTitle(currentModuleData.courseTitle);
            if (currentModuleData.pathId) setCoursePathId(currentModuleData.pathId);

            if (currentModuleData.courseId) {
                const siblingsQ = query(
                    collection(db, 'modules'),
                    where('courseId', '==', currentModuleData.courseId),
                    where('isActive', '==', true),
                    orderBy('order', 'asc')
                );

                if (!currentModuleData.courseTitle || !currentModuleData.pathId) {
                    const [courseDoc, modulesSnapshot] = await Promise.all([
                        getDoc(doc(db, 'courses', currentModuleData.courseId)),
                        getDocs(siblingsQ),
                    ]);

                    if (courseDoc.exists()) {
                        const courseData = courseDoc.data();
                        if (!currentModuleData.courseTitle) setCourseTitle(courseData.title);
                        if (!currentModuleData.pathId) setCoursePathId(courseData.pathId || null);
                    }

                    setCourseModules(modulesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Module)));
                } else {
                    const modulesSnapshot = await getDocs(siblingsQ);
                    setCourseModules(modulesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Module)));
                }
            }

        } catch (error) {
            console.error('Error loading module data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        if (coursePathId) {
            router.push(`/paths/${coursePathId}`);
        } else {
            router.push('/dashboard');
        }
    };

    const hasQuiz = !!(module?.questions && module.questions.length > 0);

    const togglePlay = () => {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) v.play(); else v.pause();
    };

    const toggleMute = () => {
        const v = videoRef.current;
        if (!v) return;
        v.muted = !v.muted;
        setIsMuted(v.muted);
    };

    const toggleFullscreen = () => {
        const el = videoContainerRef.current;
        if (!el) return;
        if (!document.fullscreenElement) {
            (el.requestFullscreen?.() || (el as any).webkitRequestFullscreen?.());
        } else {
            document.exitFullscreen?.();
        }
    };

    useEffect(() => {
        const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onFsChange);
        return () => document.removeEventListener('fullscreenchange', onFsChange);
    }, []);

    const formatTime = (t: number) => {
        if (!isFinite(t) || t < 0) return '0:00';
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleTimeUpdate = async () => {
        if (!videoRef.current || !module) return;
        const currentTime = videoRef.current.currentTime;
        setVideoCurrentTime(currentTime);
        if (currentTime > maxTimeRef.current) {
            maxTimeRef.current = currentTime;
        }
        const percentage = (currentTime / videoRef.current.duration) * 100;

        if (percentage - lastWatchedRef.current >= 2) {
            lastWatchedRef.current = percentage;
            setWatchedPercentage(percentage);
        }

        if (percentage >= module.requiredWatchPercentage) {
            setCanTakeQuiz(true);

            // Auto-completar módulos sin quiz al alcanzar el porcentaje requerido
            if (!hasQuiz && !autoCompletedRef.current && !userProgress[module.id]?.completed && user) {
                autoCompletedRef.current = true;
                try {
                    const userRef = doc(db, 'users', user.uid);
                    await updateDoc(userRef, {
                        [`progress.${module.id}`]: {
                            completed: true,
                            score: null,
                            lastAttempt: Timestamp.now(),
                        }
                    });
                    setUserProgress(prev => ({
                        ...prev,
                        [module.id]: { completed: true, score: null }
                    }));

                    // Verificar completación en cascada (curso → ruta)
                    try {
                        await checkCascadeCompletion(user.uid, module.id, module.courseId);
                    } catch (cascadeError) {
                        console.error('Error en validación en cascada:', cascadeError);
                    }
                } catch (error) {
                    console.error('Error auto-completing module:', error);
                    autoCompletedRef.current = false;
                }
            }
        }
    };

    const handleStartQuiz = () => {
        setShowQuizModal(true);
    };

    const currentIndex = courseModules.findIndex(m => m.id === module?.id);
    const nextModule = currentIndex >= 0 && currentIndex < courseModules.length - 1 ? courseModules[currentIndex + 1] : null;
    const isNextLocked = nextModule && module ? !userProgress[module.id]?.completed : true;

    const handleNext = () => {
        if (nextModule && !isNextLocked) {
            router.push(`/modules/${nextModule.id}`);
        }
    };

    if (loading) {
        return <LoadingScreen message="Cargando módulo..." />;
    }

    if (!module) return null;

    return (
        <div className="flex bg-surface font-sans text-on-surface h-screen overflow-hidden">
            {/* Sidebar Overlay (Mobile) */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-scrim/20 backdrop-blur-sm z-40 lg:hidden transition-opacity"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar de Navegación */}
            <aside className={`fixed lg:relative inset-y-0 left-0 z-50 w-72 bg-surface border-r border-outline-variant/15 flex flex-col transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:hidden'}`}>
                <div className="p-6 border-b border-outline-variant/15 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-on-surface leading-snug line-clamp-2">{courseTitle || 'Contenido del Curso'}</h2>
                    <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 text-secondary hover:text-on-surface hover:bg-surface-dim rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {courseModules.map((m, idx) => {
                        const isCompleted = userProgress[m.id]?.completed;
                        const isCurrent = m.id === module.id;
                        const isLocked = idx > 0 && !userProgress[courseModules[idx - 1].id]?.completed && !isCurrent;

                        return (
                            <button
                                key={m.id}
                                onClick={() => !isLocked && router.push(`/modules/${m.id}`)}
                                disabled={isLocked}
                                className={`w-full text-left flex items-start p-4 rounded-2xl transition-all duration-300 border border-transparent ${isCurrent ? 'bg-primary-container/20 border-primary/20' : isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-surface-dim'}`}
                            >
                                <div className="mt-1 mr-4">
                                    {isCompleted ? (
                                        <CheckCircle size={18} className="text-emerald-500" />
                                    ) : isLocked ? (
                                        <Lock size={18} className="text-secondary opacity-60" />
                                    ) : isCurrent ? (
                                        <PlayCircle size={18} className="text-primary animate-pulse" />
                                    ) : (
                                        <div className="w-4 h-4 rounded-full border border-outline-variant" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <span className={`block text-sm ${isCurrent ? 'font-bold text-primary' : 'font-medium text-on-surface'}`}>
                                        {m.order}. {m.title}
                                    </span>
                                    <span className={`block text-[10px] tracking-wide uppercase mt-1 ${isCurrent ? 'text-primary' : isCompleted ? 'text-emerald-500' : 'text-secondary'}`}>
                                        {isCurrent ? 'Reproduciendo' : isCompleted ? 'Completado' : 'Pendiente'}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </aside>

            {/* Contenido Principal */}
            <main className="flex-1 flex flex-col h-full bg-surface overflow-hidden relative">
                {/* Header Superior */}
                <header className="h-16 border-b border-outline-variant/15 flex items-center justify-between px-4 sm:px-6 bg-surface/80 backdrop-blur-md z-30 shrink-0">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 text-on-surface hover:bg-surface-dim rounded-lg transition-colors lg:hidden" title="Menú de Curso">
                            <Menu size={20} />
                        </button>
                        <button onClick={handleBack} className="flex items-center gap-2 text-sm font-bold text-secondary hover:text-on-surface transition-colors uppercase tracking-wider">
                            <ChevronLeft size={16} /> <span className="hidden sm:inline">Volver</span>
                        </button>
                    </div>

                    <div className="flex-1 text-center hidden md:block px-6">
                        <span className="text-[10px] font-extrabold text-primary uppercase tracking-widest mb-1 block">LECCIÓN ACTUAL</span>
                        <span className="text-sm font-bold text-on-surface line-clamp-1">{module.title}</span>
                    </div>

                    <div className="flex items-center gap-3">
                        {nextModule ? (
                            <Button
                                onClick={handleNext}
                                variant="tertiary"
                                className={isNextLocked ? 'opacity-50' : ''}
                                title={isNextLocked ? 'Completa esta lección' : 'Siguiente Lección'}
                                disabled={isNextLocked}
                            >
                                <span className="hidden sm:inline uppercase text-[11px] tracking-wider px-2">Siguiente</span> <ChevronRight size={16} />
                            </Button>
                        ) : (
                            <Button
                                onClick={handleBack}
                                variant="tertiary"
                                title="Volver al curso"
                            >
                                <span className="hidden sm:inline uppercase text-[11px] tracking-wider px-2">Finalizar</span> <CheckCircle size={16} className="ml-1" />
                            </Button>
                        )}

                        <button
                            onClick={() => setInfoOpen(!infoOpen)}
                            className={`p-2 rounded-lg transition-colors ${infoOpen ? 'bg-primary/10 text-primary' : 'text-on-surface hover:bg-surface-dim'}`}
                            title="Información de la Lección"
                        >
                            {infoOpen ? <ChevronRight size={20} /> : <Info size={20} />}
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto w-full relative">
                    <div className="w-full flex justify-center bg-surface-container-lowest">
                        <div ref={videoContainerRef} className="w-full max-w-5xl aspect-video bg-black relative shadow-md group/video">
                            <video
                                ref={videoRef}
                                src={videoSrc || undefined}
                                playsInline
                                disablePictureInPicture
                                onContextMenu={(e) => e.preventDefault()}
                                onTimeUpdate={handleTimeUpdate}
                                onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration || 0)}
                                onPlay={() => setIsPlaying(true)}
                                onPause={() => setIsPlaying(false)}
                                onVolumeChange={(e) => setIsMuted(e.currentTarget.muted)}
                                onSeeking={(e) => {
                                    const v = e.currentTarget;
                                    if (v.currentTime > maxTimeRef.current + 1) {
                                        v.currentTime = maxTimeRef.current;
                                    }
                                }}
                                onClick={togglePlay}
                                onEnded={() => {
                                    setIsPlaying(false);
                                    if (canTakeQuiz && hasQuiz) {
                                        setShowQuizModal(true);
                                    }
                                }}
                                className="w-full h-full object-contain lesson-video"
                            />

                            {/* Play overlay cuando el video está pausado */}
                            {!isPlaying && (
                                <button
                                    onClick={togglePlay}
                                    className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
                                    aria-label="Reproducir"
                                >
                                    <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center shadow-xl">
                                        <Play size={36} className="text-[#60356a] ml-1" fill="currentColor" />
                                    </div>
                                </button>
                            )}

                            {/* Controles custom (sin timeline) */}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-3 select-none">
                                <button
                                    onClick={togglePlay}
                                    className="p-1.5 text-white hover:text-[#f5a944] transition-colors"
                                    aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
                                >
                                    {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
                                </button>

                                <button
                                    onClick={toggleMute}
                                    className="p-1.5 text-white hover:text-[#f5a944] transition-colors"
                                    aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}
                                >
                                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                                </button>

                                <span className="text-white text-xs sm:text-sm font-medium tabular-nums">
                                    {formatTime(videoCurrentTime)} / {formatTime(videoDuration)}
                                </span>

                                {/* Barra visual no interactiva (solo indicador) */}
                                <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden pointer-events-none">
                                    <div
                                        className="h-full bg-[#f5a944] transition-[width] duration-200"
                                        style={{ width: videoDuration ? `${(videoCurrentTime / videoDuration) * 100}%` : '0%' }}
                                    />
                                </div>

                                <button
                                    onClick={toggleFullscreen}
                                    className="p-1.5 text-white hover:text-[#f5a944] transition-colors"
                                    aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                                >
                                    {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="max-w-5xl mx-auto p-6 md:p-10 pb-24">
                        <h3 className="text-2xl font-bold text-on-surface tracking-tight mb-4">Acerca de esta lección</h3>
                        <p className="text-base text-on-surface-variant leading-relaxed max-w-4xl">{module.description}</p>
                    </div>
                </div>
            </main>

            {/* Panel de Información (Derecha) */}
            <aside className={`fixed inset-y-0 right-0 z-40 w-80 lg:w-96 bg-surface-container-lowest border-l border-outline-variant/15 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${infoOpen ? 'translate-x-0' : 'translate-x-full lg:hidden'} pt-16 lg:pt-0`}>
                <div className="h-full flex flex-col">
                    <div className="p-6 border-b border-outline-variant/15 flex items-center justify-between">
                        <span className="text-sm font-bold text-on-surface uppercase tracking-wider">Tu Progreso</span>
                        <button onClick={() => setInfoOpen(false)} className="lg:hidden p-2 text-secondary hover:text-on-surface hover:bg-surface-dim rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-6 flex-1 space-y-8 overflow-y-auto">
                        <div className="space-y-6">
                            {/* Progreso Video */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-sm font-bold">
                                    <div className="flex items-center gap-2 text-secondary">
                                        <Clock size={16} className="text-primary" />
                                        <span>Progreso Video</span>
                                    </div>
                                    <span className="text-on-surface">{Math.round(watchedPercentage)}%</span>
                                </div>
                                <div className="h-2 w-full bg-surface-dim rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
                                        style={{ width: `${Math.round(watchedPercentage)}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Requisito para avanzar */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-sm font-bold">
                                    <div className="flex items-center gap-2 text-secondary">
                                        <Trophy size={16} className={canTakeQuiz ? 'text-emerald-500' : 'text-secondary/70'} />
                                        <span>{hasQuiz ? 'Requisito Quiz' : 'Requisito Video'}</span>
                                    </div>
                                    <span className="text-on-surface">{module.requiredWatchPercentage}%</span>
                                </div>
                                <div className="h-2 w-full bg-surface-dim rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-outline-variant transition-all duration-300 ease-out rounded-full"
                                        style={{ width: `${module.requiredWatchPercentage}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>

                        {!canTakeQuiz && (
                            <div className="glass-panel bg-orange-50/50 border border-orange-200/50 rounded-2xl p-4 flex items-start gap-3">
                                <AlertCircle size={20} className="text-orange-500 flex-shrink-0" />
                                <p className="text-xs text-orange-900 leading-relaxed font-medium">
                                    {hasQuiz
                                        ? <>Debes ver al menos el <strong className="font-extrabold">{module.requiredWatchPercentage}% del video</strong> para habilitar la evaluación y avanzar.</>
                                        : <>Debes ver al menos el <strong className="font-extrabold">{module.requiredWatchPercentage}% del video</strong> para completar este módulo y avanzar.</>
                                    }
                                </p>
                            </div>
                        )}

                        <div className="pt-6 border-t border-outline-variant/15 mt-auto">
                            {hasQuiz ? (
                                <Button
                                    onClick={handleStartQuiz}
                                    disabled={!canTakeQuiz && !userProgress[module.id]?.completed}
                                    className="w-full py-4 uppercase tracking-widest text-xs font-black shadow-xl"
                                    variant={userProgress[module.id]?.completed ? 'secondary' : 'primary'}
                                >
                                    {userProgress[module.id]?.completed ? 'Revisar Resultados' : 'Iniciar Evaluación'}
                                </Button>
                            ) : userProgress[module.id]?.completed ? (
                                <div className="flex flex-col items-center gap-3">
                                    <div className="flex items-center gap-2 text-emerald-600">
                                        <CheckCircle size={20} />
                                        <span className="text-sm font-bold uppercase tracking-wider">Módulo completado</span>
                                    </div>
                                    {nextModule && (
                                        <Button
                                            onClick={handleNext}
                                            className="w-full py-4 uppercase tracking-widest text-xs font-black shadow-xl"
                                            variant="primary"
                                        >
                                            Siguiente Módulo <ChevronRight size={16} className="inline ml-1" />
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2 text-secondary">
                                    <PlayCircle size={24} className="text-primary" />
                                    <p className="text-xs text-center font-medium leading-relaxed">
                                        Este módulo no requiere evaluación.<br />
                                        Completa el video para continuar.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </aside>

            {/* Quiz Modal */}
            {showQuizModal && module && user && (
                <QuizModal
                    module={module}
                    user={user}
                    canTakeQuiz={canTakeQuiz}
                    onClose={() => setShowQuizModal(false)}
                    onQuizPassed={(score: number) => {
                        setUserProgress(prev => ({
                            ...prev,
                            [module.id]: { completed: true, score }
                        }));
                    }}
                    showToast={(message: string, type: ToastType) => setToast({ message, type })}
                    handleBack={handleBack}
                />
            )}

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
}
