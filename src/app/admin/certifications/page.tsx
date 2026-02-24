'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, CertificationLevel } from '@/types';
import { Award, Check, X, Loader2, Users, BookOpen, Briefcase, ChevronRight, CheckCircle2, Circle, Search } from 'lucide-react';
import styles from './page.module.css';

interface EvalResponse {
    question: string;
    answer: string;
}

interface StudentRow {
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
    none: ['Documentación de Identidad', 'Evaluación Enviada', 'Entrevista Inicial'],
    fundamental: ['Compromiso Firmado', 'Prueba Técnica Fundamental', 'Validación de Antecedentes'],
    professional: ['Proyecto Entregado', 'Evaluación 360', 'Casos Prácticos Aprobados'],
    elite: ['Mentoría Completada', 'Certificación Externa', 'Entrevista Final con Director'],
};

const PIPELINE_STAGES = [
    { id: 'none', label: 'Candidatos', color: '#64748b', lightColor: '#f1f5f9', icon: Users, next: 'fundamental' },
    { id: 'fundamental', label: 'Fundamental', color: '#3b82f6', lightColor: '#eff6ff', icon: BookOpen, next: 'professional' },
    { id: 'professional', label: 'Profesional', color: '#c084fc', lightColor: '#faf5ff', icon: Briefcase, next: 'elite' },
    { id: 'elite', label: 'Élite', color: '#f59e0b', lightColor: '#fffbeb', icon: Award, next: null },
] as const;

// Lookup map para acceso O(1) por id
const STAGE_BY_ID = Object.fromEntries(PIPELINE_STAGES.map(s => [s.id, s]));

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
    const [supervisorNote, setSupervisorNote] = useState('');
    const [savingNote, setSavingNote] = useState(false);

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
        setSupervisorNote(student.supervisorFeedback || '');
    };

    // P3: Optimistic update
    const toggleChecklist = async (student: StudentRow, requirement: string, isChecked: boolean) => {
        const newChecklist = { ...student.stageChecklist, [requirement]: isChecked };
        const updatedStudent = { ...student, stageChecklist: newChecklist };

        // Actualizar UI primero (optimistic)
        setStudents(prev => prev.map(s => s.uid === student.uid ? updatedStudent : s));
        setDrawerTarget(prev => prev && prev.uid === student.uid ? updatedStudent : prev);

        try {
            await updateDoc(doc(db, 'users', student.uid), {
                stageChecklist: newChecklist
            });
        } catch (error) {
            console.error('Error updating checklist:', error);
            // Rollback
            setStudents(prev => prev.map(s => s.uid === student.uid ? student : s));
            setDrawerTarget(prev => prev && prev.uid === student.uid ? student : prev);
        }
    };

    const saveSupervisorNote = async () => {
        if (!drawerTarget) return;
        setSavingNote(true);
        try {
            const trimmed = supervisorNote.trim();
            await updateDoc(doc(db, 'users', drawerTarget.uid), {
                supervisorFeedback: trimmed,
            });

            // B1: Functional state update
            const uid = drawerTarget.uid;
            setStudents(prev => prev.map(s => s.uid === uid ? { ...s, supervisorFeedback: trimmed } : s));
            setDrawerTarget(prev => prev && prev.uid === uid ? { ...prev, supervisorFeedback: trimmed } : prev);
        } catch (error) {
            console.error('Error saving note:', error);
        } finally {
            setSavingNote(false);
        }
    };

    const handlePromote = async (student: StudentRow) => {
        const nextLevel = STAGE_BY_ID[student.certificationLevel]?.next;
        if (!nextLevel) return;

        try {
            await updateDoc(doc(db, 'users', student.uid), {
                attitudinalStatus: 'green',
                certificationLevel: nextLevel,
            });

            if (student.evaluationId) {
                await updateDoc(doc(db, 'attitudinal_evaluations', student.evaluationId), {
                    semaphore: 'green',
                    supervisorApproved: true,
                });
            }

            // B1: Functional update
            const uid = student.uid;
            setStudents(prev => prev.map(s => s.uid === uid ? { ...s, attitudinalStatus: 'green', certificationLevel: nextLevel as CertificationLevel } : s));
            setDrawerTarget(prev => prev && prev.uid === uid ? { ...prev, attitudinalStatus: 'green', certificationLevel: nextLevel as CertificationLevel } : prev);
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
                                                            <div className={styles.avatarWrapper} style={{ borderColor: theme.dot }}>
                                                                {student.photoURL ? (
                                                                    <img src={student.photoURL} alt={student.displayName} className={styles.avatarImg} />
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

            {/* ========== PREMIUM DRAWER ========== */}
            {drawerTarget && (
                <>
                    <div className={styles.drawerOverlay} onClick={() => setDrawerTarget(null)} />
                    <div className={styles.drawer}>
                        <div className={styles.drawerNavbar}>
                            <button onClick={() => setDrawerTarget(null)} className={styles.drawerBackBtn}>
                                <ChevronRight size={20} /> Detalle del Candidato
                            </button>
                            <button onClick={() => setDrawerTarget(null)} className={styles.drawerCloseIcon}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className={styles.drawerBody}>
                            {/* Profile Header Centered */}
                            <div className={styles.drawerProfileCenter}>
                                <div className={styles.hugeAvatarWrapper} style={{ borderColor: SEMAPHORE_THEMES[drawerTarget.attitudinalStatus]?.dot || '#cbd5e1' }}>
                                    {drawerTarget.photoURL ? (
                                        <img src={drawerTarget.photoURL} alt={drawerTarget.displayName} className={styles.hugeAvatarImg} />
                                    ) : (
                                        <div className={styles.hugeAvatarFallback}>{drawerTarget.displayName?.charAt(0).toUpperCase()}</div>
                                    )}
                                </div>
                                <h2 className={styles.profileName}>{drawerTarget.displayName}</h2>
                                <p className={styles.profileEmail}>{drawerTarget.email}</p>

                                <div className={styles.profileBadgesGroup}>
                                    <span className={styles.profileLevelBadge} style={{ backgroundColor: STAGE_BY_ID[drawerTarget.certificationLevel]?.lightColor, color: STAGE_BY_ID[drawerTarget.certificationLevel]?.color }}>
                                        <CheckCircle2 size={12} /> {STAGE_BY_ID[drawerTarget.certificationLevel]?.label || 'Sin Nivel'}
                                    </span>
                                    <span className={styles.profileIdBadge}>ID: {generateDisplayId(drawerTarget.uid)}</span>
                                </div>
                            </div>

                            <hr className={styles.divider} />

                            {/* Checklist Premium */}
                            <div className={styles.drawerSection}>
                                <h3 className={styles.sectionHeading}>Requisitos de la Etapa</h3>
                                <div className={styles.checklistGrid}>
                                    {STAGE_REQUIREMENTS[drawerTarget.certificationLevel || 'none']?.map((req, i) => {
                                        const isChecked = !!drawerTarget.stageChecklist?.[req];
                                        return (
                                            <div key={i} className={styles.checkRow} onClick={() => toggleChecklist(drawerTarget, req, !isChecked)}>
                                                <div className={styles.checkIconBox}>
                                                    {isChecked ? <CheckCircle2 size={24} color="#10b981" /> : <Circle size={24} color="#cbd5e1" />}
                                                </div>
                                                <span className={`${styles.checkText} ${isChecked ? styles.checkTextDone : ''}`}>{req}</span>
                                                <span className={`${styles.checkStatus} ${isChecked ? styles.statusCursado : styles.statusProceso}`}>
                                                    {isChecked ? 'COMPLETADO' : 'EN PROCESO'}
                                                </span>
                                            </div>
                                        );
                                    })}
                                    {(!STAGE_REQUIREMENTS[drawerTarget.certificationLevel || 'none'] || STAGE_REQUIREMENTS[drawerTarget.certificationLevel || 'none'].length === 0) && (
                                        <p className={styles.emptyNotice}>No hay requisitos configurados para esta etapa.</p>
                                    )}
                                </div>
                            </div>

                            {/* Evaluations - Grid layout */}
                            <div className={styles.drawerSection}>
                                <h3 className={styles.sectionHeading}>Evaluación Actitudinal</h3>
                                {drawerTarget.responses.length === 0 ? (
                                    <div className={styles.emptyCardBox}>No ha completado su evaluación.</div>
                                ) : (
                                    <div className={styles.evaluationsGrid}>
                                        {drawerTarget.responses.map((r, i) => {
                                            // Simulate concise titles from the prompt design
                                            const shortTitle = r.question.length > 35 ? r.question.substring(0, 35) + '...' : r.question;
                                            return (
                                                <div key={i} className={styles.evalGridCard}>
                                                    <div className={styles.evalGridTitle}>
                                                        PREGUNTA {i + 1}
                                                    </div>
                                                    <div className={styles.evalGridQuestion}>{shortTitle}</div>
                                                    <div className={styles.evalGridAnswer}>{r.answer}</div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Supervisor Note */}
                            <div className={styles.drawerSection}>
                                <div className={styles.headingWithAction}>
                                    <h3 className={styles.sectionHeading}>Nota del Supervisor</h3>
                                    <button onClick={saveSupervisorNote} disabled={savingNote} className={styles.ghostSaveBtn}>
                                        {savingNote ? <Loader2 size={14} className={styles.spin} /> : 'Guardar cambios'}
                                    </button>
                                </div>
                                <div className={styles.textareaWrapper}>
                                    <textarea
                                        className={styles.premiumTextarea}
                                        value={supervisorNote}
                                        onChange={e => setSupervisorNote(e.target.value)}
                                        placeholder="Candidato con alto potencial técnico y excelente comunicación. Se recomienda su paso directo a la etapa profesional..."
                                        rows={3}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Sticky Footer Actions */}
                        <div className={styles.drawerActionFooter}>
                            <button
                                onClick={() => handleReject(drawerTarget)}
                                className={styles.actionBtnReject}
                                disabled={drawerTarget.attitudinalStatus === 'red'}
                            >
                                {drawerTarget.attitudinalStatus === 'red' ? 'Rechazado' : 'Rechazar'}
                            </button>

                            {(() => {
                                const current = STAGE_BY_ID[drawerTarget.certificationLevel];
                                const nextLabel = current?.next ? STAGE_BY_ID[current.next]?.label : null;
                                return nextLabel ? (
                                    <button onClick={() => handlePromote(drawerTarget)} className={styles.actionBtnApprove}>
                                        Aprobar a {nextLabel}
                                    </button>
                                ) : (
                                    <button className={styles.actionBtnApprove} disabled style={{ opacity: 0.5 }}>
                                        Certificación Completa
                                    </button>
                                );
                            })()}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
