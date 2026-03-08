'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Brain, ArrowRight, ArrowLeft, Send, CheckCircle, Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, setDoc, updateDoc, doc, Timestamp, query, where, getDocs } from 'firebase/firestore';
import styles from './page.module.css';

const QUESTIONS = [
    '¿Por qué quieres ser asesor inmobiliario en Urbanity? ¿Qué te motiva de este negocio?',
    'Describe una situación difícil en la que tuviste que convencer o persuadir a alguien. ¿Cómo la manejaste?',
    '¿Qué harías si un cliente te dice información incorrecta sobre un producto o proyecto? ¿Cómo reaccionarías?',
    '¿Cómo manejas el rechazo en un contexto profesional? ¿Qué haces cuando un cliente dice que no?',
    '¿Cuáles son tus metas profesionales y de ingresos en los próximos 6 meses? ¿Cómo planeas alcanzarlas?',
];

export default function EvaluacionActitudinalPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState<string[]>(new Array(QUESTIONS.length).fill(''));
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState('');

    // CAPA 2: Guard síncrono contra race conditions
    const submitLockRef = useRef(false);

    const handleAnswer = (value: string) => {
        const newAnswers = [...answers];
        newAnswers[currentQuestion] = value;
        setAnswers(newAnswers);
    };

    const handleNext = () => {
        if (currentQuestion < QUESTIONS.length - 1) {
            setCurrentQuestion(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (currentQuestion > 0) {
            setCurrentQuestion(prev => prev - 1);
        }
    };

    const handleSubmit = async () => {
        if (!user) return;

        // Validate all answers have at least 20 characters
        const incomplete = answers.findIndex(a => a.trim().length < 20);
        if (incomplete !== -1) {
            setCurrentQuestion(incomplete);
            setError('Cada respuesta debe tener al menos 20 caracteres.');
            return;
        }

        // CAPA 2: Guard síncrono — previene doble ejecución
        if (submitLockRef.current) return;
        submitLockRef.current = true;
        setIsSubmitting(true);
        setError('');

        try {
            // CAPA 2 (refuerzo): Verificar si ya existe una evaluación para este usuario
            const existingQ = query(
                collection(db, 'attitudinal_evaluations'),
                where('userId', '==', user.uid)
            );
            const existingSnap = await getDocs(existingQ);
            if (!existingSnap.empty) {
                setError('Ya enviaste una evaluación actitudinal. Tu respuesta está en revisión.');
                setIsSubmitted(true);
                return;
            }

            const evalData = {
                userId: user.uid,
                responses: QUESTIONS.map((q, i) => ({
                    question: q,
                    answer: answers[i],
                })),
                semaphore: 'pending',
                aiAnalysis: 'Evaluación manual requerida.',
                strengths: [],
                concerns: [],
                recommendation: '',
                supervisorApproved: null,
                createdAt: Timestamp.now(),
            };

            // CAPA 3: ID determinístico para write-once en Firestore rules
            const evalDocId = `atteval_${user.uid}`;
            await setDoc(doc(db, 'attitudinal_evaluations', evalDocId), evalData);

            // Update user's attitudinal status
            await updateDoc(doc(db, 'users', user.uid), {
                attitudinalStatus: 'pending',
            });

            setIsSubmitted(true);
        } catch (err: any) {
            console.error('Error al enviar:', err);
            setError('Ocurrió un error al enviar tu evaluación. Por favor intenta de nuevo.');
            // Desbloquear para permitir reintento en caso de error de red
            submitLockRef.current = false;
        } finally {
            setIsSubmitting(false);
        }
    };

    const allAnswered = answers.every(a => a.trim().length >= 20);
    const isLastQuestion = currentQuestion === QUESTIONS.length - 1;

    // Results/Success view
    if (isSubmitted) {
        return (
            <div className={styles.page}>
                <div className={styles.container}>
                    <div className={styles.resultsCard}>
                        <div className={`${styles.semaphore} ${styles.pending}`}>
                            ⏳
                        </div>
                        <h2 className={styles.resultTitle}>¡Evaluación Enviada!</h2>
                        <p className={styles.resultMessage}>
                            Tus respuestas han sido recibidas exitosamente y están siendo analizadas.
                            <br /><br />
                            <strong>El equipo de Gerencia Comercial revisará detenidamente tu perfil.</strong>
                            <br />Te notificaremos el resultado en cuanto se complete la evaluación.
                        </p>

                        <div style={{ marginTop: '2rem' }}>
                            <button
                                onClick={() => router.push('/dashboard')}
                                className={styles.btnPrimary}
                                style={{ margin: '0 auto' }}
                            >
                                <CheckCircle size={18} />
                                Entendido, volver al Inicio
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Submitting view
    if (isSubmitting) {
        return (
            <div className={styles.page}>
                <div className={styles.container}>
                    <div className={styles.card}>
                        <div className={styles.analyzing}>
                            <div className={styles.analyzingSpinner} />
                            <h3 className={styles.analyzingTitle}>Enviando respuestas...</h3>
                            <p className={styles.analyzingText}>
                                Por favor espera mientras guardamos tu información.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.headerIcon}>
                        <Brain size={32} color="white" />
                    </div>
                    <h1 className={styles.title}>Evaluación Actitudinal</h1>
                    <p className={styles.subtitle}>
                        Responde con sinceridad y detalle. El gerente comercial evaluará estas respuestas para determinar tu perfil.
                    </p>
                </div>

                {/* Progress dots */}
                <div className={styles.progressBar}>
                    {QUESTIONS.map((_, i) => (
                        <div
                            key={i}
                            className={`${styles.progressDot} ${i === currentQuestion ? styles.active : ''} ${answers[i].trim().length >= 20 ? styles.done : ''}`}
                        />
                    ))}
                </div>

                {/* Question card */}
                <div className={styles.card} key={currentQuestion}>
                    <div className={styles.questionNumber}>
                        Pregunta {currentQuestion + 1} de {QUESTIONS.length}
                    </div>
                    <h2 className={styles.questionText}>
                        {QUESTIONS[currentQuestion]}
                    </h2>
                    <textarea
                        className={styles.textarea}
                        value={answers[currentQuestion]}
                        onChange={(e) => handleAnswer(e.target.value)}
                        placeholder="Escribe tu respuesta aquí con honestidad y mayor detalle posible (Mínimo 20 caracteres)..."
                        maxLength={1000}
                    />
                    <div className={styles.charCount}>
                        {answers[currentQuestion].length} / 1000
                    </div>

                    {error && (
                        <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.5rem', fontWeight: 600 }}>
                            {error}
                        </div>
                    )}

                    <div className={styles.actions}>
                        <button
                            onClick={handlePrev}
                            disabled={currentQuestion === 0}
                            className={styles.btnSecondary}
                        >
                            <ArrowLeft size={16} style={{ display: 'inline', marginRight: 4 }} />
                            Anterior
                        </button>

                        {isLastQuestion ? (
                            <button
                                onClick={handleSubmit}
                                disabled={!allAnswered || isSubmitting}
                                className={styles.btnPrimary}
                                style={{ opacity: isSubmitting ? 0.7 : 1 }}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <Send size={16} />
                                        Enviar Evaluación
                                    </>
                                )}
                            </button>
                        ) : (
                            <button
                                onClick={handleNext}
                                disabled={answers[currentQuestion].trim().length < 20}
                                className={styles.btnPrimary}
                            >
                                Siguiente
                                <ArrowRight size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

