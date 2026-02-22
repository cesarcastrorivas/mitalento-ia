'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, AttitudinalEvaluation, CertificationLevel } from '@/types';
import { Award, Check, X, MessageSquare, Loader2 } from 'lucide-react';
import styles from './page.module.css';

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
}

const LEVEL_LABELS: Record<string, string> = {
    none: 'Sin Nivel',
    fundamental: 'Fundamental',
    professional: 'Profesional',
    elite: 'Élite',
};

type TabFilter = 'all' | 'green' | 'yellow' | 'red' | 'pending';

export default function AdminCertificationsPage() {
    const [students, setStudents] = useState<StudentRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [levelFilter, setLevelFilter] = useState<string>('all');
    const [tabFilter, setTabFilter] = useState<TabFilter>('all');

    // Feedback modal
    const [feedbackTarget, setFeedbackTarget] = useState<StudentRow | null>(null);
    const [feedbackText, setFeedbackText] = useState('');
    const [savingFeedback, setSavingFeedback] = useState(false);

    useEffect(() => {
        loadStudents();
    }, []);

    const loadStudents = async () => {
        try {
            const usersQuery = query(collection(db, 'users'), where('role', '==', 'student'));
            const usersSnap = await getDocs(usersQuery);

            const evalsSnap = await getDocs(collection(db, 'attitudinal_evaluations'));
            const evals = new Map<string, { id: string; semaphore: string }>();
            evalsSnap.docs.forEach(d => {
                const data = d.data();
                evals.set(data.userId, { id: d.id, semaphore: data.semaphore });
            });

            const sessionsSnap = await getDocs(collection(db, 'quiz_sessions'));
            const userScores = new Map<string, { total: number; count: number }>();
            sessionsSnap.docs.forEach(d => {
                const data = d.data();
                if (!userScores.has(data.userId)) {
                    userScores.set(data.userId, { total: 0, count: 0 });
                }
                const entry = userScores.get(data.userId)!;
                entry.total += data.score;
                entry.count += 1;
            });

            // Get commitments
            const commitmentsSnap = await getDocs(collection(db, 'commitments'));
            const commitments = new Set<string>();
            commitmentsSnap.docs.forEach(d => commitments.add(d.data().userId));

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
                };
            });

            setStudents(rows);
        } catch (error) {
            console.error('Error loading students:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (studentUid: string, evalId?: string) => {
        try {
            await updateDoc(doc(db, 'users', studentUid), {
                attitudinalStatus: 'green',
                certificationLevel: 'fundamental',
            });
            if (evalId) {
                await updateDoc(doc(db, 'attitudinal_evaluations', evalId), {
                    supervisorApproved: true,
                });
            }
            setStudents(prev => prev.map(s =>
                s.uid === studentUid
                    ? { ...s, attitudinalStatus: 'green', certificationLevel: 'fundamental' as CertificationLevel }
                    : s
            ));
        } catch (error) {
            console.error('Error approving:', error);
        }
    };

    const handleReject = async (studentUid: string, evalId?: string) => {
        try {
            await updateDoc(doc(db, 'users', studentUid), {
                attitudinalStatus: 'red',
            });
            if (evalId) {
                await updateDoc(doc(db, 'attitudinal_evaluations', evalId), {
                    supervisorApproved: false,
                });
            }
            setStudents(prev => prev.map(s =>
                s.uid === studentUid ? { ...s, attitudinalStatus: 'red' } : s
            ));
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
    const filtered = students.filter(s => {
        if (tabFilter !== 'all' && s.attitudinalStatus !== tabFilter) return false;
        if (levelFilter !== 'all' && s.certificationLevel !== levelFilter) return false;
        return true;
    });

    // Stats
    const totalStudents = students.length;
    const greens = students.filter(s => s.attitudinalStatus === 'green').length;
    const yellows = students.filter(s => s.attitudinalStatus === 'yellow').length;
    const reds = students.filter(s => s.attitudinalStatus === 'red').length;
    const pendings = students.filter(s => s.attitudinalStatus === 'pending').length;

    const TABS: { key: TabFilter; label: string; count: number }[] = [
        { key: 'all', label: 'Todos', count: totalStudents },
        { key: 'green', label: '🟢 Aprobados', count: greens },
        { key: 'yellow', label: '🟡 Revisión', count: yellows },
        { key: 'red', label: '🔴 No Aptos', count: reds },
        { key: 'pending', label: '⏳ Pendientes', count: pendings },
    ];

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h1 className={styles.title}>
                    <Award size={24} /> Panel de Certificaciones
                </h1>
                <p className={styles.subtitle}>
                    Gestiona evaluaciones actitudinales y niveles de certificación
                </p>
            </div>

            {/* Stats */}
            <div className={styles.statsBar}>
                <div className={styles.statCard}>
                    <div className={styles.statValue}>{totalStudents}</div>
                    <div className={styles.statLabel}>Total Estudiantes</div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statValue} style={{ color: '#10b981' }}>{greens}</div>
                    <div className={styles.statLabel}>🟢 Aprobados</div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statValue} style={{ color: '#f59e0b' }}>{yellows}</div>
                    <div className={styles.statLabel}>🟡 En Revisión</div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statValue} style={{ color: '#ef4444' }}>{reds}</div>
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
                                                {s.attitudinalStatus === 'green' && '🟢 Aprobado'}
                                                {s.attitudinalStatus === 'yellow' && '🟡 Revisión'}
                                                {s.attitudinalStatus === 'red' && '🔴 No Apto'}
                                                {s.attitudinalStatus === 'pending' && '⏳ Pendiente'}
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
                                                {(s.attitudinalStatus === 'yellow' || s.attitudinalStatus === 'pending') && (
                                                    <>
                                                        <button
                                                            onClick={() => handleApprove(s.uid, s.evaluationId)}
                                                            className={styles.approveBtn}
                                                        >
                                                            <Check size={12} /> Aprobar
                                                        </button>
                                                        <button
                                                            onClick={() => handleReject(s.uid, s.evaluationId)}
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

            {/* Feedback Modal */}
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
