'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, query, where, orderBy, getDocs, Timestamp, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Module } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import styles from './page.module.css';
import { ChevronLeft, ChevronRight, CheckCircle, Lock, AlertCircle, Trophy, Clock, PlayCircle, Menu, X, Info } from 'lucide-react';
import LoadingScreen from '@/components/LoadingScreen';
import Toast, { ToastType } from '@/components/Toast';
import dynamic from 'next/dynamic';

const QuizModal = dynamic(() => import('@/components/modules/QuizModal'), {
    ssr: false,
    loading: () => (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl">
                <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-sm font-medium text-slate-500">Cargando evaluación...</p>
            </div>
        </div>
    ),
});

type ViewState = 'video' | 'quiz' | 'results';
type TabState = 'info' | 'notes';

export default function ModulePage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const videoRef = useRef<HTMLVideoElement>(null);
    const lastWatchedRef = useRef(0); // tracks last % sent to state, avoids stale closure
    const moduleId = params.id as string;

    const [module, setModule] = useState<Module | null>(null);
    const [loading, setLoading] = useState(true);

    // Info Panel State (Right Sidebar)
    const [infoOpen, setInfoOpen] = useState(true);

    // Estado Legacy/Auxiliar
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [watchedPercentage, setWatchedPercentage] = useState(0);
    const [canTakeQuiz, setCanTakeQuiz] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // New Modal State
    const [showQuizModal, setShowQuizModal] = useState(false);

    const [courseModules, setCourseModules] = useState<Module[]>([]);
    const [userProgress, setUserProgress] = useState<Record<string, any>>({});
    const [courseTitle, setCourseTitle] = useState('');
    const [coursePathId, setCoursePathId] = useState<string | null>(null);

    // Legacy ViewState (para evitar errores en lógica no migrada, aunque intentaremos no usarlo)
    const [viewState, setViewState] = useState<ViewState>('video');

    useEffect(() => {
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
        // MOCK DATA FOR PREVIEW
        if (moduleId === 'preview') {
            const mockModule: Module = {
                id: 'preview',
                courseId: 'mock-course',
                title: 'Introducción al Liderazgo Efectivo',
                description: 'Aprende los fundamentos del liderazgo moderno y cómo inspirar a tu equipo para alcanzar resultados extraordinarios. Esta lección cubre los principios básicos de comunicación, empatía y visión estratégica.',
                videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', // Sample video
                order: 1,
                isActive: true, // Assuming isActive is required
                passingScore: 80,
                requiredWatchPercentage: 90,
                transcription: 'Transcripción de ejemplo...',
                createdAt: Timestamp.now(),
                createdBy: 'mock-admin',
            };
            setModule(mockModule);
            setCourseTitle('Curso de Liderazgo Avanzado');

            // Mock sibling modules
            const mockModules: Module[] = [
                mockModule,
                { ...mockModule, id: '2', title: 'Comunicación Asertiva', order: 2, videoUrl: '' },
                { ...mockModule, id: '3', title: 'Resolución de Conflictos', order: 3, videoUrl: '' },
                { ...mockModule, id: '4', title: 'Gestión del Tiempo', order: 4, videoUrl: '' },
                { ...mockModule, id: '5', title: 'Inteligencia Emocional', order: 5, videoUrl: '' },
            ];
            setCourseModules(mockModules);

            // Mock user progress
            setUserProgress({
                'preview': { completed: false, score: 0 },
                '2': { completed: false, score: 0 }
            });

            setLoading(false);
            return;
        }

        try {
            // 1. Módulo + progreso del usuario en paralelo (independientes entre sí)
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

            // 2. Usar datos denormalizados si existen, sino fallback a fetch del curso
            if (currentModuleData.courseTitle) {
                setCourseTitle(currentModuleData.courseTitle);
            }
            if (currentModuleData.pathId) {
                setCoursePathId(currentModuleData.pathId);
            }

            // Cargar módulos hermanos (siempre necesario para la sidebar)
            if (currentModuleData.courseId) {
                const siblingsQ = query(
                    collection(db, 'modules'),
                    where('courseId', '==', currentModuleData.courseId),
                    where('isActive', '==', true),
                    orderBy('order', 'asc')
                );

                // Solo fetch del curso si no hay datos denormalizados
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
                    // Datos denormalizados disponibles: solo cargar siblings
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
        // Al "volver", vamos a la ruta de aprendizaje (lista de cursos)
        if (coursePathId) {
            router.push(`/paths/${coursePathId}`);
        } else {
            router.push('/dashboard');
        }
    };

    const handleTimeUpdate = () => {
        if (!videoRef.current || !module) return;
        const percentage = (videoRef.current.currentTime / videoRef.current.duration) * 100;

        // Only update state every 2% to avoid re-renders on every video frame (~30/s)
        if (percentage - lastWatchedRef.current >= 2) {
            lastWatchedRef.current = percentage;
            setWatchedPercentage(percentage);
        }

        if (percentage >= module.requiredWatchPercentage) {
            setCanTakeQuiz(true);
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
        <div className={styles.layout}>
            {/* 0. Overlay Transparente (Mobile Drawer) */}
            <div
                className={`${styles.sidebarOverlay} ${sidebarOpen ? styles.active : ''}`}
                onClick={() => setSidebarOpen(false)}
            />

            {/* 1. Sidebar de Navegación (Izquierda) */}
            <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : styles.sidebarClosed} select-none`}>
                <div className={styles.sidebarHeader}>
                    <h2 className="line-clamp-2">{courseTitle || 'Contenido del Curso'}</h2>
                    <button onClick={() => setSidebarOpen(false)} className="md:hidden">
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.moduleList}>
                    {courseModules.map((m, idx) => {
                        const isCompleted = userProgress[m.id]?.completed;
                        const isCurrent = m.id === module.id;
                        const isLocked = idx > 0 && !userProgress[courseModules[idx - 1].id]?.completed && !isCurrent;

                        return (
                            <button
                                key={m.id}
                                onClick={() => !isLocked && router.push(`/modules/${m.id}`)}
                                disabled={isLocked}
                                className={`${styles.moduleItem} ${isCurrent ? styles.active : ''} ${isLocked ? styles.locked : ''}`}
                            >
                                <div className={styles.moduleStatus}>
                                    {isCompleted ? (
                                        <CheckCircle size={16} className="text-green-500" />
                                    ) : isLocked ? (
                                        <Lock size={16} className="text-gray-400" />
                                    ) : isCurrent ? (
                                        <PlayCircle size={16} className="text-purple-600" />
                                    ) : (
                                        <div className={styles.emptyCircle} />
                                    )}
                                </div>
                                <div className={styles.moduleInfo}>
                                    <span className={styles.moduleTitle}>{m.order}. {m.title}</span>
                                    <span className={styles.moduleDuration}>
                                        {isCurrent ? 'Reproduciendo' : isCompleted ? 'Completado' : 'Pendiente'}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </aside>

            {/* 2. Contenido Principal (Centro - Video + Metadata) */}
            <main className={styles.mainContent}>
                {/* Header Superior */}
                <header className={styles.topBar}>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className={styles.menuToggle} title="Menú de Curso">
                            <Menu size={20} />
                        </button>
                        <button onClick={handleBack} className={styles.backLink}>
                            <ChevronLeft size={16} /> <span className="hidden sm:inline">Volver</span>
                        </button>
                    </div>

                    {/* Título y Progreso Breve */}
                    <div className="flex-1 text-center hidden md:block">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">LECCIÓN ACTUAL</span>
                        <span className="text-sm font-bold text-gray-800 line-clamp-1">{module.title}</span>
                    </div>

                    <div className="flex items-center gap-3">
                        {nextModule ? (
                            <button
                                onClick={handleNext}
                                className={`${styles.nextLink} ${isNextLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title={isNextLocked ? 'Completa esta lección para continuar' : 'Siguiente Lección'}
                                disabled={isNextLocked}
                            >
                                <span className="hidden sm:inline">Siguiente</span> <ChevronRight size={16} />
                            </button>
                        ) : (
                            <button
                                onClick={handleBack}
                                className={styles.nextLink}
                                title="Volver al curso"
                            >
                                <span className="hidden sm:inline">Finalizar</span> <CheckCircle size={16} className="ml-1" />
                            </button>
                        )}

                        <button
                            onClick={() => setInfoOpen(!infoOpen)}
                            className={`${styles.menuToggle} ${infoOpen ? 'bg-indigo-50 text-indigo-600' : ''}`}
                            title="Información de la Lección"
                        >
                            {infoOpen ? <ChevronRight size={20} /> : <Info size={20} />}
                        </button>
                    </div>
                </header>

                <div className={styles.videoContainer}>
                    {/* Área de Video - Modo Cine Estático */}
                    <div className={styles.videoStage}>
                        <video
                            ref={videoRef}
                            src={module.videoUrl}
                            controls
                            onTimeUpdate={handleTimeUpdate}
                            onEnded={() => {
                                // Cuando el video termina (100%), abrir quiz automáticamente
                                if (canTakeQuiz) {
                                    setShowQuizModal(true);
                                }
                            }}
                            className={styles.videoPlayer}
                        />
                    </div>

                    {/* Información de la Lección debajo del video */}
                    <div className={styles.videoDescription}>
                        <h3 className="text-lg font-bold text-gray-700 mb-2 mt-2">Acerca de esta lección</h3>
                        <p className="text-gray-600 leading-relaxed max-w-4xl text-base">{module.description}</p>

                        {/* 2.5 Tarjeta de Progreso (Visible solo en Móvil) */}
                        <div className={styles.mobileStatsCard}>
                            <div className={styles.sidebarStatItem}>
                                <div className={styles.statHeaderRow}>
                                    <div className={styles.sidebarStatLabel}>
                                        <Clock size={16} className="text-indigo-500" />
                                        <span>Progreso Video</span>
                                    </div>
                                    <span className={styles.statValue}>{Math.round(watchedPercentage)}%</span>
                                </div>
                                <div className={styles.progressBarContainer}>
                                    <div
                                        className={styles.progressBarFill}
                                        style={{ width: `${Math.round(watchedPercentage)}%` }}
                                    ></div>
                                </div>
                            </div>

                            <div className={styles.sidebarStatItem}>
                                <div className={styles.statHeaderRow}>
                                    <div className={styles.sidebarStatLabel}>
                                        <Trophy size={16} className={canTakeQuiz ? 'text-green-500' : 'text-gray-400'} />
                                        <span>Requisito Quiz</span>
                                    </div>
                                    <span className={styles.statValue}>{module.requiredWatchPercentage}%</span>
                                </div>
                                <div className={styles.progressBarContainer}>
                                    <div
                                        className={styles.progressBarFill}
                                        style={{ width: `${module.requiredWatchPercentage}%`, backgroundColor: '#e2e8f0' }}
                                    ></div>
                                </div>
                            </div>

                            {!canTakeQuiz && (
                                <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-xs text-orange-800 flex items-start gap-2">
                                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-orange-500" />
                                    <p>Debes ver al menos el <strong>{module.requiredWatchPercentage}% del video</strong> para habilitar la evaluación.</p>
                                </div>
                            )}

                            <div className={styles.sidebarCta}>
                                <button
                                    onClick={handleStartQuiz}
                                    disabled={!canTakeQuiz && !userProgress[module.id]?.completed}
                                    className={styles.ctaButton}
                                >
                                    {userProgress[module.id]?.completed ? 'Revisar Resultados' : 'Iniciar Evaluación'}
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* 3. Panel de Información (Derecha) */}
            <aside className={`${styles.infoPanel} ${infoOpen ? '' : styles.infoClosed}`}>
                <div className={styles.infoHeader}>
                    <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Detalles de la Lección</span>
                    <button onClick={() => setInfoOpen(false)} className="md:hidden text-gray-400">
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.infoContent}>
                    {/* El título principal se movió debajo del video. La sidebar derecha ahora es puramente funcional. */}

                    <div className={styles.sidebarStats}>
                        <div className={styles.sidebarStatItem}>
                            <div className={styles.statHeaderRow}>
                                <div className={styles.sidebarStatLabel}>
                                    <Clock size={16} className="text-indigo-500" />
                                    <span>Progreso Video</span>
                                </div>
                                <span className={styles.statValue}>{Math.round(watchedPercentage)}%</span>
                            </div>
                            <div className={styles.progressBarContainer}>
                                <div
                                    className={styles.progressBarFill}
                                    style={{ width: `${Math.round(watchedPercentage)}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className={styles.sidebarStatItem}>
                            <div className={styles.statHeaderRow}>
                                <div className={styles.sidebarStatLabel}>
                                    <Trophy size={16} className={canTakeQuiz ? 'text-green-500' : 'text-gray-400'} />
                                    <span>Requisito Quiz</span>
                                </div>
                                <span className={styles.statValue}>{module.requiredWatchPercentage}%</span>
                            </div>
                            <div className={styles.progressBarContainer}>
                                <div
                                    className={styles.progressBarFill}
                                    style={{ width: `${module.requiredWatchPercentage}%`, backgroundColor: '#e2e8f0' }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {!canTakeQuiz && (
                        <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-xs text-orange-800 flex items-start gap-2">
                            <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-orange-500" />
                            <p>Debes ver al menos el <strong>{module.requiredWatchPercentage}% del video</strong> para habilitar la evaluación.</p>
                        </div>
                    )}

                    <div className={styles.sidebarCta}>
                        <button
                            onClick={handleStartQuiz}
                            disabled={!canTakeQuiz && !userProgress[module.id]?.completed}
                            className={styles.ctaButton}
                        >
                            {userProgress[module.id]?.completed ? 'Revisar Resultados' : 'Iniciar Evaluación'}
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* NEW QUIZ MODAL (Dynamically Loaded) */}
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
