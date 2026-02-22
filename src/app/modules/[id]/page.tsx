'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, addDoc, collection, updateDoc, Timestamp, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Module, Question, QuizSession, UserAnswer } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { getEffectivePassingScore, checkCascadeCompletion } from '@/lib/grading-utils';
import styles from './page.module.css';
import { ChevronLeft, ChevronRight, Play, CheckCircle, Lock, AlertCircle, Trophy, Clock, Star, ArrowRight, PlayCircle, FileText, Menu, X, Info } from 'lucide-react';
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

    // Info Panel State (Right Sidebar)
    const [infoOpen, setInfoOpen] = useState(true);

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

        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);

        // Auto-open info only on large screens, close on mobile/tablet
        setInfoOpen(window.innerWidth > 1200);

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
                    const courseData = courseDoc.data();
                    setCourseTitle(courseData.title);
                    setCoursePathId(courseData.pathId || null);
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
        // Al "volver", vamos a la ruta de aprendizaje (lista de cursos)
        if (coursePathId) {
            router.push(`/paths/${coursePathId}`);
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
        // Forzar mínimo 80% para aprobar, respetando configuración mayor del admin
        const effectivePassingScore = getEffectivePassingScore(module.passingScore);
        const passed = calculatedScore >= effectivePassingScore;

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

                // Validación en cascada: verificar si el curso y/o la ruta se completaron
                try {
                    const cascadeResult = await checkCascadeCompletion(
                        user.uid,
                        module.id,
                        module.courseId
                    );
                    if (cascadeResult.courseCompleted) {
                        console.log(`✅ Curso ${cascadeResult.completedCourseId} completado`);
                    }
                    if (cascadeResult.pathCompleted) {
                        console.log(`🎓 Ruta ${cascadeResult.completedPathId} completada — Certificado disponible`);
                        setToast({ message: '🎓 ¡Felicidades! Has completado la ruta. Tu certificado está disponible.', type: 'success' });
                    }
                } catch (cascadeError) {
                    console.error('Error en validación en cascada:', cascadeError);
                }
            }

            setScore(calculatedScore);
            // setViewState('results'); // YA NO CAMBIAMOS EL VIEWSTATE
        } catch (error) {
            console.error('Error saving quiz:', error);
            setToast({ message: 'Error al guardar el quiz', type: 'error' });
        }
    };


    const handleStartQuiz = () => {
        // setToolsOpen(true); // No longer needed
        // setActiveToolTab('quiz'); // No longer needed
        setShowQuizModal(true);
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

                    {/* Información de la Lección MOVIDA AL SIDEBAR */}
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
                    <div>
                        <h1 className={styles.sidebarTitle}>{module.title}</h1>
                        <div className="flex items-center gap-2 mt-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${userProgress[module.id]?.completed
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                {userProgress[module.id]?.completed ? 'Completado' : 'En Progreso'}
                            </span>
                        </div>
                    </div>

                    <div className={styles.sidebarStats}>
                        <div className={styles.sidebarStatItem}>
                            <div className={styles.sidebarStatLabel}>
                                <Clock size={16} className="text-indigo-500" />
                                <span>Progreso Video</span>
                            </div>
                            <span className="font-bold text-gray-700">{Math.round(watchedPercentage)}%</span>
                        </div>

                        <div className={styles.sidebarStatItem}>
                            <div className={styles.sidebarStatLabel}>
                                <Trophy size={16} className={canTakeQuiz ? 'text-green-500' : 'text-gray-400'} />
                                <span>Requisito Quiz</span>
                            </div>
                            <span>{module.requiredWatchPercentage}%</span>
                        </div>
                    </div>

                    <div className={styles.sidebarDesc}>
                        <p>{module.description}</p>
                    </div>

                    {!canTakeQuiz && (
                        <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 text-xs text-orange-700 flex items-start gap-2">
                            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                            <p>Debes ver al menos el {module.requiredWatchPercentage}% del video para habilitar la evaluación.</p>
                        </div>
                    )}

                    <div className={styles.sidebarCta}>
                        <button
                            onClick={handleStartQuiz}
                            className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-colors flex items-center justify-center gap-2 shadow-lg"
                        >
                            <Trophy size={18} />
                            {userProgress[module.id]?.completed ? 'Ver Resultados / Reintentar' : 'Iniciar Evaluación'}
                        </button>
                    </div>
                </div>
            </aside>

            {/* NEW QUIZ MODAL */}
            {showQuizModal && (
                <div className={styles.quizOverlay}>
                    <div className={styles.quizModal}>
                        <div className={styles.modalHeader}>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-indigo-600 tracking-wider uppercase">Evaluación</span>
                            </div>
                            <button onClick={() => setShowQuizModal(false)} className={styles.modalCloseBtn}>
                                <X size={24} />
                            </button>
                        </div>

                        <div className={styles.modalContent}>
                            {/* ESTADO 1: INTRO / START */}
                            {!quizSession && !generatingQuiz && questions.length === 0 && (
                                <div className={styles.modalIntro}>
                                    <div className={styles.introIcon}>
                                        <Trophy size={40} />
                                    </div>
                                    <h3 className={styles.introTitle}>¡Hora de demostrar lo que sabes!</h3>
                                    <p className={styles.introDesc}>
                                        Responde estas preguntas rápidas para validar tu conocimiento sobre "{module.title}".
                                        Necesitas un <strong>{module.passingScore}%</strong> para aprobar.
                                    </p>

                                    <div className="flex justify-center w-full">
                                        <button
                                            onClick={() => {
                                                if (questions.length === 0) generateQuiz();
                                            }}
                                            disabled={!canTakeQuiz}
                                            className={`${styles.startQuizBtn} max-w-sm`}
                                        >
                                            {!canTakeQuiz ? `Video al ${module.requiredWatchPercentage}% requerido` : 'Comenzar Evaluación'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ESTADO 2: GENERANDO */}
                            {generatingQuiz && (
                                <div className={styles.modalIntro}>
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600 mb-6 mx-auto"></div>
                                    <h3 className="text-xl font-bold text-gray-800 mb-2">Preparando tu examen...</h3>
                                    <p className="text-gray-500">Nuestra IA está diseñando preguntas personalizadas para ti.</p>
                                </div>
                            )}

                            {/* ESTADO 3: PREGUNTAS ACTIVAS */}
                            {!quizSession && questions.length > 0 && currentQuestion && (
                                <div className={styles.modalQuestionContainer}>
                                    <div className={styles.questionProgress}>
                                        <span>Pregunta {currentQuestionIndex + 1} de {questions.length}</span>
                                        <div className={styles.progressBarTrack}>
                                            <div
                                                className={styles.progressBarFill}
                                                style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                                            />
                                        </div>
                                    </div>

                                    <h2 className={styles.modalQuestionText}>{currentQuestion.text}</h2>

                                    <div className={styles.modalOptionsList}>
                                        {currentQuestion.options.map((option, index) => (
                                            <button
                                                key={index}
                                                onClick={() => handleAnswerSelect(currentQuestion.id, index)}
                                                className={`${styles.modalOptionBtn} ${answers.get(currentQuestion.id) === index ? styles.modalOptionSelected : ''}`}
                                            >
                                                <span className={styles.optionLetter}>
                                                    {String.fromCharCode(65 + index)}
                                                </span>
                                                <span className="flex-1 font-medium">{option}</span>
                                                {answers.get(currentQuestion.id) === index && (
                                                    <CheckCircle size={20} className="text-indigo-600" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ESTADO 4: RESULTADOS */}
                            {quizSession && (
                                <div className={styles.modalResults}>
                                    <Confetti active={quizSession.passed} />

                                    <div className={styles.bigScore}>
                                        {score}<span className="text-2xl text-gray-400">%</span>
                                    </div>
                                    <div className={styles.scoreLabel}>Tu Puntuación Final</div>

                                    <h3 className={`${styles.resultTitle} ${quizSession.passed ? styles.passed : styles.failed}`}>
                                        {quizSession.passed ? '¡Excelente Trabajo!' : 'Inténtalo de Nuevo'}
                                    </h3>

                                    <p className={styles.resultMessage}>
                                        {quizSession.passed
                                            ? 'Has demostrado un gran dominio del tema. Estás listo para avanzar al siguiente nivel.'
                                            : 'No te preocupes, el aprendizaje es un proceso. Repasa el video y vuelve a intentarlo.'}
                                    </p>

                                    <div className={styles.resultActions}>
                                        {!quizSession.passed ? (
                                            <button
                                                onClick={() => {
                                                    setQuizSession(null);
                                                    setQuestions([]);
                                                    setAnswers(new Map());
                                                    // Generate new quiz logic could be here if we want fresh questions
                                                    generateQuiz();
                                                }}
                                                className={`${styles.modalNavBtn} ${styles.primaryBtn}`}
                                            >
                                                Reintentar Quiz
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setShowQuizModal(false);
                                                    handleBack(); // Or specific logic to go to next module directly
                                                }}
                                                className={`${styles.modalNavBtn} ${styles.primaryBtn}`}
                                            >
                                                Siguiente Lección <ArrowRight size={18} className="inline ml-2" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer only visible during active quiz to hold nav buttons */}
                        {!quizSession && questions.length > 0 && !generatingQuiz && (
                            <div className={styles.modalFooter}>
                                <button
                                    onClick={handlePreviousQuestion}
                                    disabled={currentQuestionIndex === 0}
                                    className={`${styles.modalNavBtn} ${styles.secondaryBtn}`}
                                >
                                    Anterior
                                </button>
                                {currentQuestionIndex < questions.length - 1 ? (
                                    <button
                                        onClick={handleNextQuestion}
                                        className={`${styles.modalNavBtn} ${styles.primaryBtn}`}
                                    >
                                        Siguiente
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleSubmitQuiz}
                                        disabled={!allAnswered}
                                        className={`${styles.modalNavBtn} ${styles.primaryBtn}`}
                                    >
                                        Finalizar Evaluación
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
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
