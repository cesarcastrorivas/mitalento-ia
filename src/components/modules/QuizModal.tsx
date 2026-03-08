'use client';

import React, { useState, useRef } from 'react';
import { addDoc, setDoc, collection, updateDoc, doc, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Module, Question, QuizSession, UserAnswer, User } from '@/types';
import { getEffectivePassingScore, checkCascadeCompletion } from '@/lib/grading-utils';
import { Trophy, CheckCircle, ArrowRight, X, Loader2 } from 'lucide-react';
import Confetti from '@/components/Confetti';
import styles from '@/app/modules/[id]/page.module.css';

interface QuizModalProps {
    module: Module;
    user: User;
    canTakeQuiz: boolean;
    onClose: () => void;
    onQuizPassed: (score: number) => void;
    showToast: (message: string, type: 'success' | 'error') => void;
    handleBack: () => void;
}

export default function QuizModal({
    module,
    user,
    canTakeQuiz,
    onClose,
    onQuizPassed,
    showToast,
    handleBack
}: QuizModalProps) {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Map<string, number>>(new Map());
    const [generatingQuiz, setGeneratingQuiz] = useState(false);
    const [quizSession, setQuizSession] = useState<QuizSession | null>(null);
    const [score, setScore] = useState(0);

    // ══════════════════════════════════════════════════════════
    // CAPA 1 (UI) + CAPA 2 (Idempotencia): Estado de envío
    // - isSubmitting: bloquea el botón visualmente (Capa UI)
    // - submitLockRef: guard contra race conditions incluso si
    //   React no ha re-renderizado aún (Capa Lógica)
    // ══════════════════════════════════════════════════════════
    const [isSubmitting, setIsSubmitting] = useState(false);
    const submitLockRef = useRef(false);

    const startQuiz = () => {
        if (!module.questions || module.questions.length === 0) {
            showToast('Este módulo aún no tiene un examen configurado.', 'error');
            return;
        }

        // Randomize options and questions if needed, but for now just use the fixed ones
        setQuestions(module.questions);
        setCurrentQuestionIndex(0);
        setAnswers(new Map());
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
        // ══════════════════════════════════════════════════════════
        // CAPA 2: Guard de idempotencia con useRef
        // El ref se evalúa sincrónicamente ANTES de cualquier await,
        // por lo que dos clics rápidos nunca pasan ambos este check.
        // useState solo no basta porque el re-render es asíncrono.
        // ══════════════════════════════════════════════════════════
        if (submitLockRef.current) return;
        submitLockRef.current = true;
        setIsSubmitting(true); // CAPA 1: feedback visual inmediato

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
        const effectivePassingScore = getEffectivePassingScore(module.passingScore);
        const passed = calculatedScore >= effectivePassingScore;

        try {
            // ══════════════════════════════════════════════════════════
            // CAPA 2 (refuerzo): Verificación pre-escritura en cliente
            // Consulta si ya existe una sesión aprobada para este
            // usuario+módulo. Previene duplicados si el usuario recarga
            // la página y vuelve a enviar.
            // ══════════════════════════════════════════════════════════
            if (passed) {
                const existingQ = query(
                    collection(db, 'quiz_sessions'),
                    where('userId', '==', user.uid),
                    where('moduleId', '==', module.id),
                    where('passed', '==', true)
                );
                const existingSnap = await getDocs(existingQ);
                if (!existingSnap.empty) {
                    // Ya existe una sesión aprobada — no duplicar
                    showToast('Esta evaluación ya fue registrada exitosamente.', 'success');
                    setQuizSession({
                        id: existingSnap.docs[0].id,
                        ...existingSnap.docs[0].data()
                    } as QuizSession);
                    setScore(existingSnap.docs[0].data().score);
                    return;
                }
            }

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

            // ══════════════════════════════════════════════════════════
            // CAPA 3: ID determinístico para sesiones aprobadas
            // Si el quiz fue aprobado, usamos un ID predecible
            // "{userId}_{moduleId}" para que Firestore rules pueda
            // aplicar la regla write-once con exists(). Si no aprobó,
            // usamos addDoc normal (puede reintentar).
            // ══════════════════════════════════════════════════════════
            let sessionId: string;
            if (passed) {
                sessionId = `${user.uid}_${module.id}`;
                const sessionRef = doc(db, 'quiz_sessions', sessionId);
                await setDoc(sessionRef, session);
            } else {
                const docRef = await addDoc(collection(db, 'quiz_sessions'), session);
                sessionId = docRef.id;
            }
            setQuizSession({ id: sessionId, ...session } as QuizSession);

            if (passed) {
                const userRef = doc(db, 'users', user.uid);
                await updateDoc(userRef, {
                    [`progress.${module.id}`]: {
                        completed: true,
                        score: calculatedScore,
                        lastAttempt: Timestamp.now(),
                    }
                });

                // Notificar al componente padre que se pasó el quiz
                // para que actualice su estado optimista
                onQuizPassed(calculatedScore);

                try {
                    const cascadeResult = await checkCascadeCompletion(
                        user.uid,
                        module.id,
                        module.courseId
                    );
                    if (cascadeResult.pathCompleted) {
                        showToast('🎓 ¡Felicidades! Has completado la ruta. Tu certificado está disponible.', 'success');
                    }
                } catch (cascadeError) {
                    console.error('Error en validación en cascada:', cascadeError);
                }
            }

            setScore(calculatedScore);
        } catch (error) {
            console.error('Error saving quiz:', error);
            showToast('Error al guardar el quiz', 'error');
            // Desbloquear para permitir reintento en caso de error de red
            submitLockRef.current = false;
        } finally {
            setIsSubmitting(false);
        }
    };

    const currentQuestion = questions[currentQuestionIndex];
    const allAnswered = questions.every(q => answers.has(q.id));

    return (
        <div className={styles.quizOverlay}>
            <div className={styles.quizModal}>
                <div className={styles.modalHeader}>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-indigo-600 tracking-wider uppercase">Evaluación</span>
                    </div>
                    <button onClick={onClose} className={styles.modalCloseBtn}>
                        <X size={24} />
                    </button>
                </div>

                <div className={styles.modalContent}>
                    {/* ESTADO 1: INTRO / START */}
                    {!quizSession && questions.length === 0 && (
                        <div className={styles.modalIntro}>
                            <div className={styles.introIcon}>
                                <Trophy size={40} />
                            </div>
                            <h3 className={styles.introTitle}>¡Hora de demostrar lo que sabes!</h3>
                            <p className={styles.introDesc}>
                                Responde estas preguntas rápidas para validar tu conocimiento sobre "{module.title}".
                                Necesitas un <strong>{getEffectivePassingScore(module.passingScore)}%</strong> para aprobar.
                            </p>

                            <div className="flex justify-center w-full">
                                <button
                                    onClick={startQuiz}
                                    disabled={!canTakeQuiz}
                                    className={`${styles.startQuizBtn} max-w-sm`}
                                >
                                    {!canTakeQuiz ? `Video al ${module.requiredWatchPercentage}% requerido` : 'Comenzar Evaluación'}
                                </button>
                            </div>
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
                                            // Resetear lock para permitir nuevo envío
                                            submitLockRef.current = false;
                                            startQuiz();
                                        }}
                                        className={`${styles.modalNavBtn} ${styles.primaryBtn}`}
                                    >
                                        Reintentar Quiz
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => {
                                            onClose();
                                            handleBack();
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
                {!quizSession && questions.length > 0 && (
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
                                disabled={!allAnswered || isSubmitting}
                                className={`${styles.modalNavBtn} ${styles.primaryBtn}`}
                                style={{ opacity: isSubmitting ? 0.7 : 1 }}
                            >
                                {/* CAPA 1: Feedback visual inmediato al usuario */}
                                {isSubmitting ? (
                                    <>
                                        <Loader2 size={18} className="inline animate-spin mr-2" />
                                        Guardando...
                                    </>
                                ) : (
                                    'Finalizar Evaluación'
                                )}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
