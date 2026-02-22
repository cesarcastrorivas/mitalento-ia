'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Brain, ArrowRight, ArrowLeft, Send, Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import styles from './page.module.css';

const QUESTIONS = [
    '¿Por qué quieres ser asesor inmobiliario en Urbanity? ¿Qué te motiva de este negocio?',
    'Describe una situación difícil en la que tuviste que convencer o persuadir a alguien. ¿Cómo la manejaste?',
    '¿Qué harías si un cliente te dice información incorrecta sobre un producto o proyecto? ¿Cómo reaccionarías?',
    '¿Cómo manejas el rechazo en un contexto profesional? ¿Qué haces cuando un cliente dice que no?',
    '¿Cuáles son tus metas profesionales y de ingresos en los próximos 6 meses? ¿Cómo planeas alcanzarlas?',
];

interface EvalResult {
    semaphore: 'green' | 'yellow' | 'red';
    analysis: string;
    strengths: string[];
    concerns: string[];
    recommendation: string;
}

export default function EvaluacionActitudinalPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState<string[]>(new Array(QUESTIONS.length).fill(''));
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<EvalResult | null>(null);
    const [error, setError] = useState('');

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

        setIsAnalyzing(true);
        setError('');

        try {
            const response = await fetch('/api/attitudinal-eval', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.uid,
                    responses: QUESTIONS.map((q, i) => ({
                        question: q,
                        answer: answers[i],
                    })),
                }),
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            // Save to Firestore (Client-side)
            const evalData = {
                userId: user.uid,
                responses: QUESTIONS.map((q, i) => ({
                    question: q,
                    answer: answers[i],
                })),
                aiAnalysis: data.analysis,
                semaphore: data.semaphore,
                strengths: data.strengths || [],
                concerns: data.concerns || [],
                recommendation: data.recommendation || '',
                supervisorApproved: null,
                createdAt: Timestamp.now(),
            };

            try {
                await addDoc(collection(db, 'attitudinal_evaluations'), evalData);
            } catch (firestoreError: any) {
                console.error('Error saving evaluation:', firestoreError);
                throw new Error(`Error al guardar evaluación: ${firestoreError.message}`);
            }

            // Update user's attitudinal status
            try {
                await updateDoc(doc(db, 'users', user.uid), {
                    attitudinalStatus: data.semaphore,
                });
            } catch (userError: any) {
                console.error('Error updating user status:', userError);
                // Optionally we can ignore this error or show a warning, but let's report it for now to debug
                throw new Error(`Error al actualizar estado de usuario: ${userError.message}`);
            }

            setResult({
                semaphore: data.semaphore,
                analysis: data.analysis,
                strengths: data.strengths || [],
                concerns: data.concerns || [],
                recommendation: data.recommendation,
            });
        } catch (err: any) {
            setError(err.message || 'Error al procesar la evaluación');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const allAnswered = answers.every(a => a.trim().length >= 20);
    const isLastQuestion = currentQuestion === QUESTIONS.length - 1;

    const SEMAPHORE_CONFIG = {
        green: { emoji: '🟢', label: '¡Perfil Aprobado!', color: '#10b981' },
        yellow: { emoji: '🟡', label: 'En Revisión por Supervisor', color: '#f59e0b' },
        red: { emoji: '🔴', label: 'Perfil No Apto', color: '#ef4444' },
    };

    // Results view
    if (result) {
        const config = SEMAPHORE_CONFIG[result.semaphore];
        return (
            <div className={styles.page}>
                <div className={styles.container}>
                    <div className={styles.resultsCard}>
                        <div className={`${styles.semaphore} ${styles[result.semaphore]}`}>
                            {config.emoji}
                        </div>
                        <h2 className={styles.resultTitle}>{config.label}</h2>
                        <p className={styles.resultAnalysis}>{result.analysis}</p>

                        {result.strengths.length > 0 && (
                            <div className={styles.resultTags}>
                                {result.strengths.map((s, i) => (
                                    <span key={i} className={styles.tagStrength}>✅ {s}</span>
                                ))}
                            </div>
                        )}

                        {result.concerns.length > 0 && (
                            <div className={styles.resultTags}>
                                {result.concerns.map((c, i) => (
                                    <span key={i} className={styles.tagConcern}>⚠️ {c}</span>
                                ))}
                            </div>
                        )}

                        <p className={styles.resultMessage}>
                            {result.semaphore === 'green'
                                ? 'Tu evaluación ha sido registrada exitosamente. Puedes continuar con tu certificación.'
                                : result.semaphore === 'yellow'
                                    ? 'Tu evaluación será revisada por un supervisor. Te notificaremos el resultado.'
                                    : 'Lamentablemente no cumples con el perfil requerido en este momento.'}
                        </p>

                        <div style={{ marginTop: '1.5rem' }}>
                            <button
                                onClick={() => router.push('/dashboard')}
                                className={styles.btnPrimary}
                                style={{ margin: '0 auto' }}
                            >
                                Volver al Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Analyzing view
    if (isAnalyzing) {
        return (
            <div className={styles.page}>
                <div className={styles.container}>
                    <div className={styles.card}>
                        <div className={styles.analyzing}>
                            <div className={styles.analyzingSpinner} />
                            <h3 className={styles.analyzingTitle}>Analizando tu perfil...</h3>
                            <p className={styles.analyzingText}>
                                Nuestra IA está evaluando tus respuestas para determinar tu perfil actitudinal.
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
                        Responde con sinceridad. Esta evaluación determina tu alineación con los valores y cultura de Urbanity.
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
                        placeholder="Escribe tu respuesta aquí con honestidad y detalle..."
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
                                disabled={!allAnswered}
                                className={styles.btnPrimary}
                            >
                                <Send size={16} />
                                Enviar Evaluación
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
