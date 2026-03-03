'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, CertificationLevel } from '@/types';
import { Award, Loader2, Users, BookOpen, Briefcase, Search } from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import styles from './page.module.css';

// Lazy load the drawer component
const StudentDetailDrawer = dynamic(() => import('@/components/admin/StudentDetailDrawer'), {
    ssr: false,
    loading: () => <div className={styles.loadingContainer}><Loader2 className={styles.spin} size={40} color="#4f46e5" /></div>
});

interface EvalResponse {
    question: string;
    answer: string;
}

export interface StudentRow {
    uid: string;
    displayName: string;
    email: string;
    photoURL?: string;
    certificationLevel: CertificationLevel;
    attitudinalStatus: string;
    avgScore: number;
    evaluationId?: string;
    commitment: boolean;
    supervisorFeedback?: string;
    responses: EvalResponse[];
    stageChecklist?: Record<string, boolean>;
}

const STAGE_REQUIREMENTS: Record<string, string[]> = {
    none: [
        'Documento de identidad verificado',
        'Primera entrevista realizada',
        'Datos de contacto completos',
        'Contrato de confidencialidad firmado',
    ],
    fundamental: [
        'Módulos completados (Cultura, Marco Legal y ADN Urbanity)',
        'Evaluación actitudinal completada',
        'Compromiso de estándares firmado',
    ],
    professional: [
        'Módulos completados (Método Comercial)',
        'Uso de Script oficial Urbanity',
        'Checklist obligatorio de visita completado',
        'Simulación grabada de cierre aprobada',
        'Validación por supervisor obtenida',
    ],
    elite: [
        'Módulos completados (Alto Desempeño y Liderazgo)',
        'Caso práctico estratégico resuelto',
        'Presentación de plan de acción 30-60-90 días',
        'Evaluación actitudinal final completada',
    ],
};

// Etiqueta del score a validar por etapa
const SCORE_LABELS: Record<string, string> = {
    none: '',
    fundamental: 'Examen Día 1 (teórico + caso real)',
    professional: 'Evaluación teórica estructurada',
    elite: 'Ranking interno / Evaluación final',
};

const PIPELINE_STAGES = [
    { id: 'none', label: 'Candidatos', color: '#64748b', lightColor: '#f1f5f9', icon: Users, next: 'fundamental' },
    { id: 'fundamental', label: 'Fundamental', color: '#3b82f6', lightColor: '#eff6ff', icon: BookOpen, next: 'professional' },
    { id: 'professional', label: 'Profesional', color: '#c084fc', lightColor: '#faf5ff', icon: Briefcase, next: 'elite' },
    { id: 'elite', label: 'Élite', color: '#f59e0b', lightColor: '#fffbeb', icon: Award, next: null },
] as const;

// Lookup map para acceso O(1) por id
const STAGE_BY_ID = Object.fromEntries(PIPELINE_STAGES.map(s => [s.id, s]));

// Score mínimo requerido para avanzar de etapa
const MIN_SCORE_TO_PROMOTE = 80;

// Texto del botón de promoción por etapa actual
const PROMOTE_BUTTON_LABELS: Record<string, string> = {
    none: 'Admitir',
    fundamental: 'Aprobar Fundamental',
    professional: 'Aprobar Profesional',
    elite: 'Aprobar Élite',
};

// Colores más suaves y elegantes para los badges
const SEMAPHORE_LABELS: Record<string, string> = {
    green: 'Aprobado',
    yellow: 'En Revisión',
    red: 'No Apto',
    pending: 'Pendiente',
};
const SEMAPHORE_THEMES: Record<string, { bg: string, text: string, dot: string }> = {
    green: { bg: '#ecfdf5', text: '#059669', dot: '#10b981' },
    yellow: { bg: '#fffbeb', text: '#d97706', dot: '#f59e0b' },
    red: { bg: '#fef2f2', text: '#dc2626', dot: '#ef4444' },
    pending: { bg: '#f8fafc', text: '#64748b', dot: '#94a3b8' },
};

export default function AdminCertificationsPage() {
    const [students, setStudents] = useState<StudentRow[]>([]);
    const [loading, setLoading] = useState(true);

    // Search query for a premium feeling (filter local)
    const [searchQuery, setSearchQuery] = useState('');

    // Drawer state
    const [drawerTarget, setDrawerTarget] = useState<StudentRow | null>(null);

    useEffect(() => {
        loadStudents();
    }, []);

    const loadStudents = async () => {
        try {
            const [usersSnap, evalsSnap, sessionsSnap, commitmentsSnap] = await Promise.all([
                getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
                getDocs(collection(db, 'attitudinal_evaluations')),
                getDocs(collection(db, 'quiz_sessions')),
                getDocs(collection(db, 'commitments')),
            ]);

            const evals = new Map<string, { id: string; semaphore: string; responses: EvalResponse[] }>();
            evalsSnap.docs.forEach(d => {
                const data = d.data();
                evals.set(data.userId, {
                    id: d.id,
                    semaphore: data.semaphore,
                    responses: data.responses || [],
                });
            });

            const userScores = new Map<string, { total: number; count: number }>();
            sessionsSnap.docs.forEach(d => {
                const data = d.data();
                const entry = userScores.get(data.userId) || { total: 0, count: 0 };
                entry.total += data.score;
                entry.count += 1;
                userScores.set(data.userId, entry);
            });

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
                    photoURL: data.photoURL,
                    certificationLevel: (data.certificationLevel as CertificationLevel) || 'none',
                    attitudinalStatus: evalData?.semaphore || data.attitudinalStatus || 'pending',
                    avgScore: scores && scores.count > 0 ? Math.round(scores.total / scores.count) : 0,
                    evaluationId: evalData?.id,
                    commitment: commitments.has(d.id),
                    supervisorFeedback: data.supervisorFeedback || '',
                    responses: evalData?.responses || [],
                    stageChecklist: data.stageChecklist || {},
                };
            });

            setStudents(rows);
        } catch (error) {
            console.error('Error loading students:', error);
        } finally {
            setLoading(false);
        }
    };

    // R1+R3: Agrupamiento eficiente y Filtrado por búsqueda
    const studentsByStage = useMemo(() => {
        const map: Record<string, StudentRow[]> = {};
        PIPELINE_STAGES.forEach(s => map[s.id] = []);

        const q = searchQuery.toLowerCase();

        students.forEach(s => {
            if (q && !s.displayName.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q)) return;
            const key = s.certificationLevel || 'none';
            if (map[key]) map[key].push(s);
        });
        return map;
    }, [students, searchQuery]);

    const openDrawer = (student: StudentRow) => {
        setDrawerTarget(student);
    };

    // Validación: ¿puede el estudiante ser promovido?
    const canPromote = (student: StudentRow): boolean => {
        const hasNext = !!STAGE_BY_ID[student.certificationLevel]?.next;
        if (!hasNext) return false;

        const reqs = STAGE_REQUIREMENTS[student.certificationLevel] || [];
        const allChecked = reqs.length === 0 || reqs.every(r => !!student.stageChecklist?.[r]);

        // Candidatos (none): solo requiere checklist, sin score mínimo
        if (student.certificationLevel === 'none') return allChecked;
        const scoreOk = student.avgScore >= MIN_SCORE_TO_PROMOTE;
        return allChecked && scoreOk;
    };

    // Razones de bloqueo para mostrar al admin
    const getBlockedReasons = (student: StudentRow): string[] => {

        const reasons: string[] = [];
        const reqs = STAGE_REQUIREMENTS[student.certificationLevel] || [];
        const reqsChecked = reqs.filter(r => !!student.stageChecklist?.[r]).length;
        if (reqsChecked < reqs.length) {
            reasons.push(`Requisitos: ${reqsChecked}/${reqs.length} completados`);
        }
        // Candidatos no requieren score mínimo
        if (student.certificationLevel !== 'none') {
            const scoreLabel = SCORE_LABELS[student.certificationLevel] || 'Score';
            if (student.avgScore < MIN_SCORE_TO_PROMOTE) {
                reasons.push(`${scoreLabel}: ${student.avgScore}/${MIN_SCORE_TO_PROMOTE} mínimo`);
            }
        }
        return reasons;
    };

    const handlePromote = async (student: StudentRow) => {
        const nextLevel = STAGE_BY_ID[student.certificationLevel]?.next;
        if (!nextLevel) return;

        // Guardia de validación (defensa extra, el botón ya debería estar bloqueado)
        if (!canPromote(student)) return;

        try {
            await updateDoc(doc(db, 'users', student.uid), {
                attitudinalStatus: 'green',
                certificationLevel: nextLevel,
                stageChecklist: {}, // Reset checklist para la nueva etapa
            });

            if (student.evaluationId) {
                await updateDoc(doc(db, 'attitudinal_evaluations', student.evaluationId), {
                    semaphore: 'green',
                    supervisorApproved: true,
                });
            }

            // B1: Functional update
            const uid = student.uid;
            setStudents(prev => prev.map(s => s.uid === uid ? { ...s, attitudinalStatus: 'green', certificationLevel: nextLevel as CertificationLevel, stageChecklist: {} } : s));
            setDrawerTarget(prev => prev && prev.uid === uid ? { ...prev, attitudinalStatus: 'green', certificationLevel: nextLevel as CertificationLevel, stageChecklist: {} } : prev);
        } catch (error) {
            console.error('Error promoting:', error);
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
            // B1: Functional update
            const uid = student.uid;
            setStudents(prev => prev.map(s => s.uid === uid ? { ...s, attitudinalStatus: 'red' } : s));
            setDrawerTarget(prev => prev && prev.uid === uid ? { ...prev, attitudinalStatus: 'red' } : prev);
        } catch (error) {
            console.error('Error rejecting:', error);
        }
    };

    // Helper: Genera un ID estético tipo #CERT-9A2B para la UI
    const generateDisplayId = (uid: string) => `#CERT-${uid.substring(0, 4).toUpperCase()}`;

    return (
        <div className={styles.pageContainer}>
            {/* Top Bar (simulated from mockup) */}
            <div className={styles.topNavigation}>
                <div className={styles.headerTitles}>
                    <div className={styles.iconAccent}>
                        <Award size={22} color="#4f46e5" />
                    </div>
                    <div>
                        <h1 className={styles.mainTitle}>Panel de Certificaciones</h1>
                        <p className={styles.mainSubtitle}>Kanban Pipeline • Admin Dashboard</p>
                    </div>
                </div>

                <div className={styles.searchContainer}>
                    <Search size={16} className={styles.searchIcon} />
                    <input
                        type="text"
                        placeholder="Buscar candidatos..."
                        className={styles.searchInput}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Stats Bar */}
            {!loading && (
                <div className={styles.statsContainer}>
                    {PIPELINE_STAGES.map((stage, i) => {
                        const count = studentsByStage[stage.id]?.length || 0;
                        return (
                            <React.Fragment key={stage.id}>
                                <div className={styles.statCard} style={{ borderBottomColor: stage.color }}>
                                    <div className={styles.statHeader}>
                                        <span className={styles.statLabel}>{stage.label}</span>
                                    </div>
                                    <div className={styles.statBody}>
                                        <span className={styles.statCount}>{count}</span>
                                        {/* Fake static metric for the premium mockup look */}
                                        <span className={styles.statMetric} style={{ color: count > 0 ? '#10b981' : '#94a3b8' }}>
                                            {count > 0 ? '+1' : '0'} %
                                        </span>
                                    </div>
                                </div>
                                {i < PIPELINE_STAGES.length - 1 && (
                                    <div className={styles.statDivider} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            )}

            {/* Pipeline Board */}
            {loading ? (
                <div className={styles.loadingContainer}>
                    <Loader2 className={styles.spin} size={40} color="#4f46e5" />
                    <p>Cargando talento...</p>
                </div>
            ) : (
                <div className={styles.boardScrollContainer}>
                    <div className={styles.pipelineBoard}>
                        {PIPELINE_STAGES.map((stage) => {
                            const stageStudents = studentsByStage[stage.id] || [];
                            return (
                                <div key={stage.id} className={styles.pipelineColumn}>
                                    <div className={styles.columnHeader}>
                                        <div className={styles.colTitleGroup}>
                                            <div className={styles.colDot} style={{ backgroundColor: stage.color }} />
                                            <span className={styles.colTitle}>{stage.label}</span>
                                            <span className={styles.colBadge} style={{ backgroundColor: stage.lightColor, color: stage.color }}>
                                                {stageStudents.length}
                                            </span>
                                        </div>
                                        <div className={styles.colActions}>•••</div>
                                    </div>

                                    <div className={styles.columnBody}>
                                        {stageStudents.map(student => {
                                            const initial = student.displayName ? student.displayName.charAt(0).toUpperCase() : '?';
                                            const theme = SEMAPHORE_THEMES[student.attitudinalStatus] || SEMAPHORE_THEMES.pending;

                                            // Progress calculation for visual bar
                                            const reqs = STAGE_REQUIREMENTS[student.certificationLevel || 'none'] || [];
                                            const reqsChecked = reqs.filter(r => student.stageChecklist?.[r]).length;
                                            const progressPct = reqs.length > 0 ? Math.round((reqsChecked / reqs.length) * 100) : 0;

                                            return (
                                                <div key={student.uid} className={styles.kanbanCard} onClick={() => openDrawer(student)}>
                                                    <div className={styles.cardHeaderRow}>
                                                        <div className={styles.cardAvatarGroup}>
                                                            <div className={styles.avatarWrapper} style={{ borderColor: theme.dot, position: 'relative', overflow: 'hidden' }}>
                                                                {student.photoURL ? (
                                                                    <Image src={student.photoURL} alt={student.displayName} fill className="object-cover" sizes="48px" />
                                                                ) : (
                                                                    <div className={styles.avatarFallback}>{initial}</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className={styles.cardStatusBadge} style={{ backgroundColor: theme.bg, color: theme.text }}>
                                                            {SEMAPHORE_LABELS[student.attitudinalStatus]}
                                                        </div>
                                                    </div>

                                                    <div className={styles.cardIdentity}>
                                                        <h3 className={styles.cardSname}>{student.displayName}</h3>
                                                        <p className={styles.cardSid}>ID: {generateDisplayId(student.uid)}</p>
                                                    </div>

                                                    <div className={styles.cardMetrics}>
                                                        <div className={styles.cardMetricItem}>
                                                            <BookOpen size={13} color="#94a3b8" />
                                                            <span>Score: {student.avgScore}/100</span>
                                                        </div>
                                                        <div className={styles.cardReqProgress}>
                                                            <div className={styles.cardProgressBar}>
                                                                <div className={styles.cardProgressFill} style={{ width: `${progressPct}%`, backgroundColor: stage.color }} />
                                                            </div>
                                                            <span className={styles.cardProgressText}>{reqsChecked}/{reqs.length}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ========== PREMIUM DRAWER (Dynamically Loaded) ========== */}
            {drawerTarget && (
                <StudentDetailDrawer
                    student={drawerTarget}
                    onClose={() => setDrawerTarget(null)}
                    onUpdate={(updatedStudent) => {
                        setStudents(prev => prev.map(s => s.uid === updatedStudent.uid ? updatedStudent : s));
                        setDrawerTarget(updatedStudent);
                    }}
                    stageRequirements={STAGE_REQUIREMENTS}
                    stageById={STAGE_BY_ID}
                    scoreLabels={SCORE_LABELS}
                    minScoreToPromote={MIN_SCORE_TO_PROMOTE}
                    semaphoreThemes={SEMAPHORE_THEMES}
                    promoteButtonLabels={PROMOTE_BUTTON_LABELS}
                    canPromote={canPromote}
                    getBlockedReasons={getBlockedReasons}
                    handlePromote={handlePromote}
                    handleReject={handleReject}
                    generateDisplayId={generateDisplayId}
                />
            )}
        </div>
    );
}
