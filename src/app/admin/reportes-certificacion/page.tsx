'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, CertificationLevel } from '@/types';
import { FileDown, BarChart3, Users, TrendingUp } from 'lucide-react';
import styles from './page.module.css';

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

interface ReportRow {
    uid: string;
    displayName: string;
    email: string;
    certificationLevel: string;
    attitudinalStatus: string;
    avgScore: number;
    totalAttempts: number;
    passedModules: number;
    commitment: boolean;
    registrationDate: string;
}

export default function ReportesCertificacionPage() {
    const [rows, setRows] = useState<ReportRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadReportData();
    }, []);

    const loadReportData = async () => {
        try {
            // Get all students
            const usersQuery = query(collection(db, 'users'), where('role', '==', 'student'));
            const usersSnap = await getDocs(usersQuery);

            // Get quiz sessions
            const sessionsSnap = await getDocs(collection(db, 'quiz_sessions'));
            const userScores = new Map<string, { total: number; count: number; passedModules: Set<string> }>();
            sessionsSnap.docs.forEach(d => {
                const data = d.data();
                if (!userScores.has(data.userId)) {
                    userScores.set(data.userId, { total: 0, count: 0, passedModules: new Set() });
                }
                const entry = userScores.get(data.userId)!;
                entry.total += data.score;
                entry.count += 1;
                if (data.passed) entry.passedModules.add(data.moduleId);
            });

            // Get evaluations
            const evalsSnap = await getDocs(collection(db, 'attitudinal_evaluations'));
            const evals = new Map<string, string>();
            evalsSnap.docs.forEach(d => {
                const data = d.data();
                evals.set(data.userId, data.semaphore);
            });

            // Get commitments
            const commitmentsSnap = await getDocs(collection(db, 'commitments'));
            const commitments = new Set<string>();
            commitmentsSnap.docs.forEach(d => {
                commitments.add(d.data().userId);
            });

            const reportRows: ReportRow[] = usersSnap.docs.map(d => {
                const data = d.data() as User;
                const scores = userScores.get(d.id);
                return {
                    uid: d.id,
                    displayName: data.displayName,
                    email: data.email,
                    certificationLevel: data.certificationLevel || 'none',
                    attitudinalStatus: evals.get(d.id) || data.attitudinalStatus || 'pending',
                    avgScore: scores ? Math.round(scores.total / scores.count) : 0,
                    totalAttempts: scores?.count || 0,
                    passedModules: scores?.passedModules.size || 0,
                    commitment: commitments.has(d.id),
                    registrationDate: data.createdAt?.toDate?.()?.toLocaleDateString('es-MX') || 'N/A',
                };
            });

            setRows(reportRows);
        } catch (error) {
            console.error('Error loading report data:', error);
        } finally {
            setLoading(false);
        }
    };

    const exportCSV = () => {
        const headers = [
            'Nombre', 'Email', 'Nivel', 'Semáforo', 'Puntaje Promedio',
            'Intentos', 'Módulos Aprobados', 'Compromiso', 'Fecha Registro'
        ];
        const csvRows = rows.map(r => [
            r.displayName,
            r.email,
            LEVEL_LABELS[r.certificationLevel],
            SEMAPHORE_LABELS[r.attitudinalStatus] || r.attitudinalStatus,
            `${r.avgScore}%`,
            r.totalAttempts,
            r.passedModules,
            r.commitment ? 'Sí' : 'No',
            r.registrationDate,
        ]);

        const csv = [headers, ...csvRows].map(row => row.join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `reporte_certificacion_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    // Stats
    const totalStudents = rows.length;
    const avgScoreAll = totalStudents > 0 ? Math.round(rows.reduce((s, r) => s + r.avgScore, 0) / totalStudents) : 0;
    const approvedCount = rows.filter(r => r.attitudinalStatus === 'green').length;
    const approvalRate = totalStudents > 0 ? Math.round((approvedCount / totalStudents) * 100) : 0;

    // Level distribution
    const levelCounts = {
        none: rows.filter(r => r.certificationLevel === 'none').length,
        fundamental: rows.filter(r => r.certificationLevel === 'fundamental').length,
        professional: rows.filter(r => r.certificationLevel === 'professional').length,
        elite: rows.filter(r => r.certificationLevel === 'elite').length,
    };

    // Semaphore distribution
    const semaphoreCounts = {
        green: rows.filter(r => r.attitudinalStatus === 'green').length,
        yellow: rows.filter(r => r.attitudinalStatus === 'yellow').length,
        red: rows.filter(r => r.attitudinalStatus === 'red').length,
        pending: rows.filter(r => r.attitudinalStatus === 'pending').length,
    };

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h1 className={styles.title}>
                    <BarChart3 size={24} /> Reportes de Certificación
                </h1>
                <p className={styles.subtitle}>Métricas de desempeño para el área comercial</p>
            </div>

            {/* Stats */}
            <div className={styles.statsRow}>
                <div className={styles.statCard}>
                    <div className={styles.statValue}>{totalStudents}</div>
                    <div className={styles.statLabel}>Total Asesores</div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statValue}>{avgScoreAll}%</div>
                    <div className={styles.statLabel}>Puntaje Promedio</div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statValue} style={{ color: '#10b981' }}>{approvalRate}%</div>
                    <div className={styles.statLabel}>Tasa Aprobación</div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statValue}>{rows.filter(r => r.commitment).length}</div>
                    <div className={styles.statLabel}>Compromisos Firmados</div>
                </div>
            </div>

            {/* Charts */}
            <div className={styles.chartSection}>
                <div className={styles.chartCard}>
                    <h3 className={styles.chartTitle}>Distribución por Nivel</h3>
                    <div className={styles.barChart}>
                        {Object.entries(levelCounts).map(([level, count]) => (
                            <div key={level} className={styles.barRow}>
                                <span className={styles.barLabel}>{LEVEL_LABELS[level]}</span>
                                <div className={styles.barTrack}>
                                    <div
                                        className={styles.barFill}
                                        style={{
                                            width: `${totalStudents > 0 ? (count / totalStudents) * 100 : 0}%`,
                                            background: level === 'elite' ? '#ef4444' : level === 'professional' ? '#f59e0b' : level === 'fundamental' ? '#10b981' : '#9ca3af',
                                        }}
                                    >
                                        {count}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={styles.chartCard}>
                    <h3 className={styles.chartTitle}>Distribución Actitudinal</h3>
                    <div className={styles.barChart}>
                        {Object.entries(semaphoreCounts).map(([status, count]) => (
                            <div key={status} className={styles.barRow}>
                                <span className={styles.barLabel}>{status === 'green' ? '🟢 Aprobado' : status === 'yellow' ? '🟡 Revisión' : status === 'red' ? '🔴 No Apto' : '⏳ Pendiente'}</span>
                                <div className={styles.barTrack}>
                                    <div
                                        className={styles.barFill}
                                        style={{
                                            width: `${totalStudents > 0 ? (count / totalStudents) * 100 : 0}%`,
                                            background: status === 'green' ? '#10b981' : status === 'yellow' ? '#f59e0b' : status === 'red' ? '#ef4444' : '#9ca3af',
                                        }}
                                    >
                                        {count}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                    <span className={styles.tableTitle}>Detalle de Asesores</span>
                    <button onClick={exportCSV} className={styles.exportBtn} disabled={loading}>
                        <FileDown size={16} /> Exportar CSV
                    </button>
                </div>

                {loading ? (
                    <div className={styles.loading}><div className={styles.spinner} /></div>
                ) : rows.length === 0 ? (
                    <div className={styles.empty}>No hay datos disponibles</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Email</th>
                                    <th>Nivel</th>
                                    <th>Semáforo</th>
                                    <th>Puntaje</th>
                                    <th>Módulos</th>
                                    <th>Compromiso</th>
                                    <th>Registro</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(r => (
                                    <tr key={r.uid}>
                                        <td style={{ fontWeight: 600 }}>{r.displayName}</td>
                                        <td style={{ color: '#6b7280' }}>{r.email}</td>
                                        <td>
                                            <span className={`${styles.levelBadge} ${styles[r.certificationLevel]}`}>
                                                {LEVEL_LABELS[r.certificationLevel]}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`${styles.semaphore} ${styles[r.attitudinalStatus] || styles.pending}`}>
                                                {SEMAPHORE_LABELS[r.attitudinalStatus] || '⏳ Pendiente'}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: 700 }}>{r.avgScore}%</td>
                                        <td>{r.passedModules}</td>
                                        <td>{r.commitment ? '✅' : '❌'}</td>
                                        <td style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{r.registrationDate}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
