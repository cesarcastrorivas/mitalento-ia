'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, addDoc, collection, updateDoc, Timestamp, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Module, Question, QuizSession, UserAnswer } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import styles from './page.module.css';
import { ChevronLeft, ChevronRight, Play, CheckCircle, Lock, AlertCircle, Trophy, Clock, Star, ArrowRight, PlayCircle, FileText, Menu, X } from 'lucide-react';
import Confetti from '@/components/Confetti';
import LoadingScreen from '@/components/LoadingScreen';
import Toast, { ToastType } from '@/components/Toast';

type ViewState = 'video' | 'quiz' | 'results';
type TabState = 'info' | 'notes';

export default function ModulePage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const videoRef = useRef<HTMLVideoElement>(null);
    const moduleId = params.id as string;

    const [module, setModule] = useState<Module | null>(null);
    const [loading, setLoading] = useState(true);
    const [toolsOpen, setToolsOpen] = useState(false);
    // activeTab ahora controla qué herramienta ver: 'quiz' | 'notes'
    const [activeToolTab, setActiveToolTab] = useState<'quiz' | 'notes'>('quiz');

    // Estado Legacy/Auxiliar
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [watchedPercentage, setWatchedPercentage] = useState(0);
    const [canTakeQuiz, setCanTakeQuiz] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    // Quiz state
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Map<string, number>>(new Map());
    const [generatingQuiz, setGeneratingQuiz] = useState(false);
    const [quizSession, setQuizSession] = useState<QuizSession | null>(null);
    const [score, setScore] = useState(0);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const [courseModules, setCourseModules] = useState<Module[]>([]);
    const [userProgress, setUserProgress] = useState<Record<string, any>>({});
    const [courseTitle, setCourseTitle] = useState('');

    // Legacy ViewState (para evitar errores en lógica no migrada, aunque intentaremos no usarlo)
    const [viewState, setViewState] = useState<ViewState>('video');

    useEffect(() => {
        loadModuleData();

        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);

        // Auto-open tools only on large screens, close on mobile/tablet to avoid obscuring content
        setToolsOpen(window.innerWidth > 1200);

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
            // 1. Obtener el módulo actual
            const moduleDoc = await getDoc(doc(db, 'modules', moduleId));
            if (!moduleDoc.exists()) {
                router.push('/dashboard');
                return;
            }
            const currentModuleData = { id: moduleDoc.id, ...moduleDoc.data() } as Module;
            setModule(currentModuleData);

            // 2. Si tenemos el usuario, obtener su progreso actualizado
            if (user) {
                const userDocRef = doc(db, 'users', user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    setUserProgress(userDocSnap.data().progress || {});
                }
            }

            // 3. Obtener todos los módulos del curso (para la sidebar) y datos del curso
            if (currentModuleData.courseId) {
                // Datos del curso
                const courseDoc = await getDoc(doc(db, 'courses', currentModuleData.courseId));
                if (courseDoc.exists()) {
                    setCourseTitle(courseDoc.data().title);
                }

                // Lista de módulos ordenados
                const q = query(
                    collection(db, 'modules'),
                    where('courseId', '==', currentModuleData.courseId),
                    where('isActive', '==', true),
                    orderBy('order', 'asc')
                );
                const querySnapshot = await getDocs(q);
                const modulesList = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Module));
                setCourseModules(modulesList);
            }

        } catch (error) {
            console.error('Error loading module data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        if (module?.courseId) {
            router.push(`/courses/${module.courseId}`);
        } else {
            router.push('/dashboard');
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current && module) {
            const percentage = (videoRef.current.currentTime / videoRef.current.duration) * 100;
            if (percentage > watchedPercentage) {
                setWatchedPercentage(percentage);
            }

            if (percentage >= module.requiredWatchPercentage) {
                setCanTakeQuiz(true);
            }
        }
    };

    const generateQuiz = async () => {
        if (!module || !user) return;

        setGeneratingQuiz(true);

        try {
            const response = await fetch('/api/generate-quiz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    moduleId: module.id,
                    userId: user.uid,
                    transcription: module.transcription, // Use stored transcription instead of video
                    videoTitle: module.title,
                    questionCount: 5,
                }),
            });

            const data = await response.json();

            if (data.success && data.questions) {
                setQuestions(data.questions);
                // setViewState('quiz'); // YA NO CAMBIAMOS EL VIEWSTATE
                setCurrentQuestionIndex(0);
                setAnswers(new Map());
            } else {
                throw new Error(data.error || 'Error generando quiz');
            }
        } catch (error) {
            console.error('Error generating quiz:', error);
            setToast({ message: 'Error al generar el quiz. Por favor intenta de nuevo.', type: 'error' });
        } finally {
            setGeneratingQuiz(false);
        }
    };

    const handleAnswerSelect = (questionId: string, optionIndex: number) => {
        const newAnswers = new Map(answers);
        newAnswers.set(questionId, optionIndex);
        setAnswers(newAnswers);
    };

    const handleNextQuestion = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        }
    };

    const handlePreviousQuestion = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev - 1);
        }
    };

    const handleSubmitQuiz = async () => {
        if (!module || !user) return;

        let correctCount = 0;
        const userAnswers: UserAnswer[] = [];

        questions.forEach(question => {
            const selectedIndex = answers.get(question.id);
            const isCorrect = selectedIndex === question.correctIndex;
            if (isCorrect) correctCount++;

            userAnswers.push({
                questionId: question.id,
                selectedIndex: selectedIndex ?? -1,
                isCorrect,
                answeredAt: Timestamp.now(),
            });
        });

        const calculatedScore = Math.round((correctCount / questions.length) * 100);
        const passed = calculatedScore >= module.passingScore;

        try {
            const session: Omit<QuizSession, 'id'> = {
                moduleId: module.id,
                userId: user.uid,
                questions,
                answers: userAnswers,
                score: calculatedScore,
                passed,
                startedAt: Timestamp.now(),
                completedAt: Timestamp.now(),
                seed: `${user.uid}-${module.id}-${Date.now()}`,
            };

            const docRef = await addDoc(collection(db, 'quiz_sessions'), session);
            setQuizSession({ id: docRef.id, ...session } as QuizSession);

            if (passed) {
                const userRef = doc(db, 'users', user.uid);
                await updateDoc(userRef, {
                    [`progress.${module.id}`]: {
                        completed: true,
                        score: calculatedScore,
                        lastAttempt: Timestamp.now(),
                    }
                });
            }

            setScore(calculatedScore);
            // setViewState('results'); // YA NO CAMBIAMOS EL VIEWSTATE
        } catch (error) {
            console.error('Error saving quiz:', error);
            setToast({ message: 'Error al guardar el quiz', type: 'error' });
        }
    };


    const handleStartQuiz = () => {
        setToolsOpen(true);
        setActiveToolTab('quiz');
        if (!questions.length) {
            generateQuiz();
        }
    };

    // ... (Mantener lógica de quiz)

    if (loading) {
        return <LoadingScreen message="Cargando módulo..." />;
    }

    if (!module) return null;

    const currentQuestion = questions[currentQuestionIndex];
    const allAnswered = questions.every(q => answers.has(q.id));

    return (
        <div className={styles.layout}>
            {/* 1. Sidebar de Navegación (Izquierda) */}
            <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : styles.sidebarClosed}`}>
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
                        <span className="text-sm font-medium text-gray-700">{module.title}</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setToolsOpen(!toolsOpen)}
                            className={`${styles.menuToggle} ${toolsOpen ? 'bg-purple-50 text-purple-600' : ''}`}
                            title="Panel de Herramientas"
                        >
                            {toolsOpen ? <ChevronRight size={20} /> : <FileText size={20} />}
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
                            className={styles.videoPlayer}
                        />
                    </div>

                    {/* Información de la Lección (Debajo del Video) */}
                    <div className={styles.lessonInfo}>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h1 className={styles.lessonTitle}>{module.title}</h1>
                                <p className={styles.lessonDescription}>{module.description}</p>
                            </div>

                            {/* CTA Principal si el panel está cerrado o para acción rápida */}
                            <button
                                onClick={handleStartQuiz}
                                className="px-6 py-2 bg-black text-white rounded-full font-semibold text-sm hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap"
                            >
                                <Trophy size={16} />
                                {userProgress[module.id]?.completed ? 'Intentar de nuevo' : 'Ir a Evaluación'}
                            </button>
                        </div>

                        <div className={styles.videoStats}>
                            <div className={styles.statItem}>
                                <Clock size={16} />
                                <span>Progreso: {Math.round(watchedPercentage)}%</span>
                            </div>
                            <div className={styles.statItem}>
                                <Trophy size={16} className={canTakeQuiz ? 'text-green-500' : ''} />
                                <span>Requisito Quiz: {module.requiredWatchPercentage}%</span>
                            </div>
                            {!canTakeQuiz && (
                                <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-100">
                                    Sigue viendo para desbloquear el quiz
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* 3. Panel de Herramientas (Derecha - Quiz/Notas) */}
            <aside className={`${styles.toolsPanel} ${toolsOpen ? '' : styles.toolsClosed}`}>
                <div className={styles.toolsHeader}>
                    <button
                        className={`${styles.toolTab} ${activeToolTab === 'quiz' ? styles.activeTab : ''}`}
                        onClick={() => setActiveToolTab('quiz')}
                    >
                        <Trophy size={16} className="inline mr-2" />
                        Evaluación
                    </button>
                    <button
                        className={`${styles.toolTab} ${activeToolTab === 'notes' ? styles.activeTab : ''}`}
                        onClick={() => setActiveToolTab('notes')}
                    >
                        <Star size={16} className="inline mr-2" />
                        Notas
                    </button>
                </div>

                <div className={styles.toolsContent}>
                    {/* CONTENIDO TAB: QUIZ */}
                    {activeToolTab === 'quiz' && (
                        <div className="h-full">
                            {/* ESTADO 1: INTRO / START */}
                            {!quizSession && !generatingQuiz && questions.length === 0 && (
                                <div className={styles.quizStartView}>
                                    <div className={styles.quizStartIcon}>
                                        <Trophy size={32} />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-800">Evaluación de Conocimientos</h3>
                                    <p className="text-sm text-gray-500 text-center mb-4">
                                        Pon a prueba lo que aprendiste en este video. Necesitas un {module.passingScore}% para aprobar.
                                    </p>
                                    <button
                                        onClick={handleStartQuiz}
                                        disabled={!canTakeQuiz}
                                        className={styles.startQuizBtn}
                                    >
                                        {!canTakeQuiz ? `Desbloquea al ${module.requiredWatchPercentage}%` : 'Comenzar Quiz Ahora'}
                                    </button>
                                </div>
                            )}

                            {/* ESTADO 2: GENERANDO */}
                            {generatingQuiz && (
                                <div className={styles.quizStartView}>
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mb-4"></div>
                                    <p className="text-gray-600 font-medium">Generando preguntas con IA...</p>
                                </div>
                            )}

                            {/* ESTADO 3: PREGUNTAS ACTIVAS */}
                            {!quizSession && questions.length > 0 && currentQuestion && (
                                <div className={styles.quizContainer}>
                                    <div className="flex justify-between text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
                                        <span>Pregunta {currentQuestionIndex + 1}/{questions.length}</span>
                                    </div>

                                    <div className={styles.questionCard}>
                                        <p className={styles.questionText}>{currentQuestion.text}</p>

                                        <div className={styles.optionsList}>
                                            {currentQuestion.options.map((option, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => handleAnswerSelect(currentQuestion.id, index)}
                                                    className={`${styles.optionBtn} ${answers.get(currentQuestion.id) === index ? styles.optionSelected : ''}`}
                                                >
                                                    <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold mr-2 text-gray-500 flex-shrink-0">
                                                        {String.fromCharCode(65 + index)}
                                                    </span>
                                                    {option}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className={styles.navigationButtons}>
                                        <button
                                            onClick={handlePreviousQuestion}
                                            disabled={currentQuestionIndex === 0}
                                            className={styles.navBtn}
                                        >
                                            Anterior
                                        </button>
                                        {currentQuestionIndex < questions.length - 1 ? (
                                            <button onClick={handleNextQuestion} className={`${styles.navBtn} ${styles.primaryNavBtn}`}>
                                                Siguiente
                                            </button>
                                        ) : (
                                            <button
                                                onClick={handleSubmitQuiz}
                                                disabled={!allAnswered}
                                                className={`${styles.navBtn} ${styles.primaryNavBtn}`}
                                            >
                                                Finalizar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ESTADO 4: RESULTADOS */}
                            {quizSession && (
                                <div className={styles.resultsView}>
                                    <Confetti active={quizSession.passed} />
                                    <div className={`${styles.scoreCircle} ${quizSession.passed ? styles.scorePassed : styles.scoreFailed}`}>
                                        {score}%
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900">
                                        {quizSession.passed ? '¡Aprobado!' : 'No superado'}
                                    </h3>
                                    <p className="text-sm text-gray-500 mb-6">
                                        {quizSession.passed
                                            ? 'Has dominado este tema. Puedes continuar con el siguiente módulo.'
                                            : 'Te recomendamos repasar el video antes de intentar nuevamente.'}
                                    </p>

                                    {!quizSession.passed && (
                                        <button
                                            onClick={() => {
                                                setQuizSession(null);
                                                setQuestions([]);
                                                setAnswers(new Map());
                                                setViewState('video'); // Reset logic visuals
                                            }}
                                            className={styles.startQuizBtn}
                                        >
                                            Reintentar Quiz
                                        </button>
                                    )}

                                    {quizSession.passed && (
                                        <button
                                            onClick={() => {
                                                // Find next module logic or just close
                                                handleBack();
                                            }}
                                            className={styles.startQuizBtn}
                                        >
                                            Continuar Curso
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* CONTENIDO TAB: NOTAS */}
                    {activeToolTab === 'notes' && (
                        <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
                            <FileText size={48} className="mb-4 opacity-20" />
                            <p>Tus notas privadas irán aquí.</p>
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded mt-2">Próximamente</span>
                        </div>
                    )}
                </div>
            </aside>

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
