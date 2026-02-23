'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, CertificationLevel } from '@/types';
import { Award, Check, X, MessageSquare, Loader2, Eye } from 'lucide-react';
import styles from './page.module.css';

interface EvalResponse {
    question: string;
    answer: string;
}

interface StudentRow {
    uid: string;
    displayName: string;
    email: string;
    certificationLevel: CertificationLevel;
    attitudinalStatus: string;
    avgScore: number;
    evaluationId?: string;
    commitment: boolean;
    supervisorFeedback?: string;
    responses: EvalResponse[];
}

const LEVEL_LABELS: Record<string, string> = {
    none: 'Sin Nivel',
    fundamental: 'Fundamental',
    professional: 'Profesional',
    elite: 'Élite',
};

const SEMAPHORE_LABELS: Record<string, string> = {
    green: '🟢 Aprobado',
    yellow: '🟡 Revisión',
    red: '🔴 No Apto',
    pending: '⏳ Pendiente',
};

type TabFilter = 'all' | 'green' | 'yellow' | 'red' | 'pending';

export default function AdminCertificationsPage() {
    const [students, setStudents] = useState<StudentRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [levelFilter, setLevelFilter] = useState<string>('all');
    const [tabFilter, setTabFilter] = useState<TabFilter>('all');

    // Review modal (ver respuestas)
    const [reviewTarget, setReviewTarget] = useState<StudentRow | null>(null);

    // Feedback modal
    const [feedbackTarget, setFeedbackTarget] = useState<StudentRow | null>(null);
    const [feedbackText, setFeedbackText] = useState('');
    const [savingFeedback, setSavingFeedback] = useState(false);

    useEffect(() => {
        loadStudents();
    }, []);

    const loadStudents = async () => {
        try {
            // Parallel fetching for performance
            const [usersSnap, evalsSnap, sessionsSnap, commitmentsSnap] = await Promise.all([
                getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
                getDocs(collection(db, 'attitudinal_evaluations')),
                getDocs(collection(db, 'quiz_sessions')),
                getDocs(collection(db, 'commitments')),
            ]);

            // Index evaluations by userId
            const evals = new Map<string, { id: string; semaphore: string; responses: EvalResponse[] }>();
            evalsSnap.docs.forEach(d => {
                const data = d.data();
                evals.set(data.userId, {
                    id: d.id,
                    semaphore: data.semaphore,
                    responses: data.responses || [],
                });
            });

            // Index quiz scores by userId
            const userScores = new Map<string, { total: number; count: number }>();
            sessionsSnap.docs.forEach(d => {
                const data = d.data();
                const entry = userScores.get(data.userId) || { total: 0, count: 0 };
                entry.total += data.score;
                entry.count += 1;
                userScores.set(data.userId, entry);
            });

            // Index commitments
            const commitments = new Set<string>();
            commitmentsSnap.docs.forEach(d => commitments.add(d.data().userId));

            // Build rows
            const rows: StudentRow[] = usersSnap.docs.map(d => {
                const data = d.data() as User;
                const evalData = evals.get(d.id);
                const scores = userScores.get(d.id);
                return {
                    uid: d.id,
                    displayName: data.displayName,
                    email: data.email,
                    certificationLevel: (data.certificationLevel as CertificationLevel) || 'none',
                    attitudinalStatus: evalData?.semaphore || data.attitudinalStatus || 'pending',
                    avgScore: scores ? Math.round(scores.total / scores.count) : 0,
                    evaluationId: evalData?.id,
                    commitment: commitments.has(d.id),
                    supervisorFeedback: (data as any).supervisorFeedback || '',
                    responses: evalData?.responses || [],
                };
            });

            setStudents(rows);
        } catch (error) {
            console.error('Error loading students:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (student: StudentRow) => {
        try {
            await updateDoc(doc(db, 'users', student.uid), {
                attitudinalStatus: 'green',
                certificationLevel: 'fundamental',
            });
            if (student.evaluationId) {
                await updateDoc(doc(db, 'attitudinal_evaluations', student.evaluationId), {
                    semaphore: 'green',
                    supervisorApproved: true,
                });
            }
            setStudents(prev => prev.map(s =>
                s.uid === student.uid
                    ? { ...s, attitudinalStatus: 'green', certificationLevel: 'fundamental' as CertificationLevel }
                    : s
            ));
            setReviewTarget(null);
        } catch (error) {
            console.error('Error approving:', error);
        }
    };

    const handleReject = async (student: StudentRow) => {
        try {
            await updateDoc(doc(db, 'users', student.uid), {
                attitudinalStatus: 'red',
            });
            if (student.evaluationId) {
                await updateDoc(doc(db, 'attitudinal_evaluations', student.evaluationId), {
                    semaphore: 'red',
                    supervisorApproved: false,
                });
            }
            setStudents(prev => prev.map(s =>
                s.uid === student.uid ? { ...s, attitudinalStatus: 'red' } : s
            ));
            setReviewTarget(null);
        } catch (error) {
            console.error('Error rejecting:', error);
        }
    };

    const openFeedback = (student: StudentRow) => {
        setFeedbackTarget(student);
        setFeedbackText(student.supervisorFeedback || '');
    };

    const saveFeedback = async () => {
        if (!feedbackTarget) return;
        setSavingFeedback(true);
        try {
            await updateDoc(doc(db, 'users', feedbackTarget.uid), {
                supervisorFeedback: feedbackText.trim(),
            });
            setStudents(prev => prev.map(s =>
                s.uid === feedbackTarget.uid ? { ...s, supervisorFeedback: feedbackText.trim() } : s
            ));
            setFeedbackTarget(null);
        } catch (error) {
            console.error('Error saving feedback:', error);
        } finally {
            setSavingFeedback(false);
        }
    };

    // Apply filters
    const filtered = useMemo(() =>
        students.filter(s => {
            if (tabFilter !== 'all' && s.attitudinalStatus !== tabFilter) return false;
            if (levelFilter !== 'all' && s.certificationLevel !== levelFilter) return false;
            return true;
        }),
        [students, tabFilter, levelFilter]
    );

    // Stats (single pass)
    const stats = useMemo(() => {
        const counts = { total: 0, green: 0, yellow: 0, red: 0, pending: 0 };
        students.forEach(s => {
            counts.total++;
            if (s.attitudinalStatus in counts) {
                (counts as any)[s.attitudinalStatus]++;
            }
        });
        return counts;
    }, [students]);

    const TABS: { key: TabFilter; label: string; count: number }[] = [
        { key: 'all', label: 'Todos', count: stats.total },
        { key: 'green', label: '🟢 Aprobados', count: stats.green },
        { key: 'yellow', label: '🟡 Revisión', count: stats.yellow },
        { key: 'red', label: '🔴 No Aptos', count: stats.red },
        { key: 'pending', label: '⏳ Pendientes', count: stats.pending },
    ];

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h1 className={styles.title}>
                    <Award size={24} /> Panel de Certificaciones
                </h1>
                <p className={styles.subtitle}>
                    Revisa las evaluaciones actitudinales y gestiona niveles de certificación
                </p>
            </div>

            {/* Stats */}
            <div className={styles.statsBar}>
                <div className={styles.statCard}>
                    <div className={styles.statValue}>{stats.total}</div>
                    <div className={styles.statLabel}>Total Estudiantes</div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statValue} style={{ color: '#10b981' }}>{stats.green}</div>
                    <div className={styles.statLabel}>🟢 Aprobados</div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statValue} style={{ color: '#f59e0b' }}>{stats.yellow}</div>
                    <div className={styles.statLabel}>🟡 En Revisión</div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statValue} style={{ color: '#ef4444' }}>{stats.red}</div>
                    <div className={styles.statLabel}>🔴 No Aptos</div>
                </div>
            </div>

            {/* Talent Tabs */}
            <div className={styles.tabsBar}>
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setTabFilter(tab.key)}
                        className={`${styles.tabBtn} ${tabFilter === tab.key ? styles.activeTab : ''}`}
                    >
                        {tab.label} <span className={styles.tabCount}>{tab.count}</span>
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                    <span className={styles.tableTitle}>
                        {TABS.find(t => t.key === tabFilter)?.label || 'Todos'} — Base de Talento
                    </span>
                    <div className={styles.filterGroup}>
                        {['all', 'none', 'fundamental', 'professional', 'elite'].map(f => (
                            <button
                                key={f}
                                onClick={() => setLevelFilter(f)}
                                className={`${styles.filterBtn} ${levelFilter === f ? styles.active : ''}`}
                            >
                                {f === 'all' ? 'Todos' : LEVEL_LABELS[f]}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className={styles.loading}>
                        <div className={styles.spinner} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className={styles.empty}>No hay estudiantes en esta categoría</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Email</th>
                                    <th>Semáforo</th>
                                    <th>Puntaje</th>
                                    <th>Nivel</th>
                                    <th>Compromiso</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(s => (
                                    <tr key={s.uid}>
                                        <td style={{ fontWeight: 600 }}>{s.displayName}</td>
                                        <td style={{ color: '#6b7280' }}>{s.email}</td>
                                        <td>
                                            <span className={`${styles.semaphoreIndicator} ${styles[s.attitudinalStatus] || styles.pending}`}>
                                                {SEMAPHORE_LABELS[s.attitudinalStatus] || '⏳ Pendiente'}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: 700 }}>{s.avgScore}%</td>
                                        <td>
                                            <span className={`${styles.levelBadge} ${styles[s.certificationLevel]}`}>
                                                {LEVEL_LABELS[s.certificationLevel]}
                                            </span>
                                        </td>
                                        <td>{s.commitment ? '✅' : '❌'}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                {/* Ver Respuestas — only if the user has submitted eval */}
                                                {s.responses.length > 0 && (
                                                    <button
                                                        onClick={() => setReviewTarget(s)}
                                                        className={styles.viewBtn}
                                                        title="Ver respuestas de evaluación"
                                                    >
                                                        <Eye size={12} /> Ver
                                                    </button>
                                                )}
                                                {(s.attitudinalStatus === 'yellow' || s.attitudinalStatus === 'pending') && (
                                                    <>
                                                        <button
                                                            onClick={() => s.responses.length > 0 ? setReviewTarget(s) : handleApprove(s)}
                                                            className={styles.approveBtn}
                                                        >
                                                            <Check size={12} /> Aprobar
                                                        </button>
                                                        <button
                                                            onClick={() => s.responses.length > 0 ? setReviewTarget(s) : handleReject(s)}
                                                            className={styles.rejectBtn}
                                                        >
                                                            <X size={12} /> Rechazar
                                                        </button>
                                                    </>
                                                )}
                                                <button
                                                    onClick={() => openFeedback(s)}
                                                    className={styles.feedbackBtn}
                                                    title="Retroalimentación"
                                                >
                                                    <MessageSquare size={12} />
                                                    {s.supervisorFeedback ? '📝' : 'Nota'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ========== REVIEW MODAL (Ver Respuestas) ========== */}
            {reviewTarget && (
                <div className={styles.modalOverlay} onClick={() => setReviewTarget(null)}>
                    <div className={styles.reviewModal} onClick={e => e.stopPropagation()}>
                        <div className={styles.reviewModalHeader}>
                            <div>
                                <h3 className={styles.modalTitle}>
                                    <Eye size={20} /> Evaluación Actitudinal
                                </h3>
                                <p className={styles.modalSubtitle}>
                                    Candidato: <strong>{reviewTarget.displayName}</strong> — {reviewTarget.email}
                                </p>
                            </div>
                            <button onClick={() => setReviewTarget(null)} className={styles.closeBtn}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className={styles.responsesContainer}>
                            {reviewTarget.responses.length === 0 ? (
                                <p className={styles.noResponses}>Este candidato aún no ha completado su evaluación actitudinal.</p>
                            ) : (
                                reviewTarget.responses.map((r, i) => (
                                    <div key={i} className={styles.responseCard}>
                                        <div className={styles.responseQuestion}>
                                            <span className={styles.questionBadge}>P{i + 1}</span>
                                            {r.question}
                                        </div>
                                        <div className={styles.responseAnswer}>
                                            {r.answer}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Action buttons inside the review modal */}
                        {(reviewTarget.attitudinalStatus === 'pending' || reviewTarget.attitudinalStatus === 'yellow') && (
                            <div className={styles.reviewActions}>
                                <button
                                    onClick={() => handleApprove(reviewTarget)}
                                    className={styles.reviewApproveBtn}
                                >
                                    <Check size={16} /> Aprobar Candidato
                                </button>
                                <button
                                    onClick={() => handleReject(reviewTarget)}
                                    className={styles.reviewRejectBtn}
                                >
                                    <X size={16} /> Rechazar Candidato
                                </button>
                            </div>
                        )}

                        {reviewTarget.attitudinalStatus === 'green' && (
                            <div className={styles.reviewStatusBanner} style={{ background: 'rgba(16,185,129,0.08)', color: '#059669' }}>
                                🟢 Este candidato ya fue aprobado.
                            </div>
                        )}
                        {reviewTarget.attitudinalStatus === 'red' && (
                            <div className={styles.reviewStatusBanner} style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>
                                🔴 Este candidato fue rechazado.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ========== FEEDBACK MODAL ========== */}
            {feedbackTarget && (
                <div className={styles.modalOverlay} onClick={() => setFeedbackTarget(null)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <h3 className={styles.modalTitle}>
                            <MessageSquare size={18} /> Retroalimentación
                        </h3>
                        <p className={styles.modalSubtitle}>
                            Para: <strong>{feedbackTarget.displayName}</strong>
                        </p>
                        <textarea
                            className={styles.modalTextarea}
                            value={feedbackText}
                            onChange={e => setFeedbackText(e.target.value)}
                            placeholder="Escribe tu retroalimentación personalizada aquí..."
                            rows={5}
                        />
                        <div className={styles.modalActions}>
                            <button
                                onClick={() => setFeedbackTarget(null)}
                                className={styles.modalCancelBtn}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={saveFeedback}
                                disabled={savingFeedback}
                                className={styles.modalSaveBtn}
                            >
                                {savingFeedback ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
                                {savingFeedback ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
