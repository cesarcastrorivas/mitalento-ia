'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { QuizSession, Module } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import styles from './page.module.css';
import { Trophy, Target, BookOpen, TrendingUp, CheckCircle, XCircle } from 'lucide-react';

interface ProgressData {
    totalModules: number;
    completedModules: number;
    averageScore: number;
    totalAttempts: number;
    recentSessions: (QuizSession & { moduleTitle: string })[];
}

export default function ProgressPage() {
    const { user } = useAuth();
    const [data, setData] = useState<ProgressData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            loadProgressData();
        }
    }, [user]);

    const loadProgressData = async () => {
        try {
            const modulesQuery = query(
                collection(db, 'modules'),
                where('isActive', '==', true)
            );
            const modulesSnapshot = await getDocs(modulesQuery);
            const modules = new Map<string, Module>();
            modulesSnapshot.docs.forEach(doc => {
                modules.set(doc.id, { id: doc.id, ...doc.data() } as Module);
            });

            const sessionsQuery = query(
                collection(db, 'quiz_sessions'),
                where('userId', '==', user!.uid),
                orderBy('completedAt', 'desc')
            );
            const sessionsSnapshot = await getDocs(sessionsQuery);
            const sessions = sessionsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as QuizSession));

            const passedModules = new Set<string>();
            let totalScore = 0;

            sessions.forEach(session => {
                if (session.passed) {
                    passedModules.add(session.moduleId);
                }
                totalScore += session.score;
            });

            const recentSessions = sessions.slice(0, 10).map(session => ({
                ...session,
                moduleTitle: modules.get(session.moduleId)?.title || 'Módulo desconocido'
            }));

            setData({
                totalModules: modules.size,
                completedModules: passedModules.size,
                averageScore: sessions.length > 0 ? Math.round(totalScore / sessions.length) : 0,
                totalAttempts: sessions.length,
                recentSessions,
            });
        } catch (error) {
            console.error('Error loading progress:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner} />
                <p className={styles.loadingText}>Calculando tu progreso...</p>
            </div>
        );
    }

    if (!data) return null;

    const progressPercent = data.totalModules > 0
        ? Math.round((data.completedModules / data.totalModules) * 100)
        : 0;

    // Determine badge
    const getBadge = () => {
        if (progressPercent >= 100) return { label: '🏆 Máster', color: '#F59E0B' };
        if (progressPercent >= 75) return { label: '🔥 Avanzado', color: '#7C3AED' };
        if (progressPercent >= 50) return { label: '⚡ Intermedio', color: '#3B82F6' };
        if (progressPercent >= 25) return { label: '🌱 En progreso', color: '#10B981' };
        return { label: '🚀 Iniciando', color: '#64748B' };
    };

    const badge = getBadge();
    const circumference = 2 * Math.PI * 58;
    const strokeOffset = circumference - (progressPercent / 100) * circumference;
    const firstName = user?.displayName?.split(' ')[0] || 'Estudiante';

    return (
        <div className={styles.page}>
            {/* Hero Section */}
            <div className={styles.hero}>
                <div className={styles.heroBackground}>
                    <div className={styles.heroOrb1} />
                    <div className={styles.heroOrb2} />
                </div>
                <div className={styles.heroContent}>
                    <div className={styles.heroTop}>
                        <div className={styles.heroText}>
                            <h1 className={styles.heroTitle}>
                                Progreso de {firstName}
                            </h1>
                            <span className={styles.badge} style={{ color: badge.color, borderColor: `${badge.color}33` }}>
                                {badge.label}
                            </span>
                        </div>

                        {/* Circular Progress */}
                        <div className={styles.circularProgress}>
                            <svg className={styles.circleSvg} viewBox="0 0 130 130">
                                <circle className={styles.circleTrack} cx="65" cy="65" r="58" />
                                <circle
                                    className={styles.circleFill}
                                    cx="65" cy="65" r="58"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={strokeOffset}
                                />
                            </svg>
                            <div className={styles.circleValue}>
                                <span className={styles.circlePercent}>{progressPercent}</span>
                                <span className={styles.circleSymbol}>%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statIconWrapper}>
                        <BookOpen size={20} />
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statValue}>{data.completedModules}/{data.totalModules}</span>
                        <span className={styles.statLabel}>Módulos</span>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIconWrapper}>
                        <Target size={20} />
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statValue}>{data.averageScore}%</span>
                        <span className={styles.statLabel}>Promedio</span>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIconWrapper}>
                        <TrendingUp size={20} />
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statValue}>{data.totalAttempts}</span>
                        <span className={styles.statLabel}>Intentos</span>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIconWrapper}>
                        <Trophy size={20} />
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statValue}>{progressPercent}%</span>
                        <span className={styles.statLabel}>Total</span>
                    </div>
                </div>
            </div>

            {/* Recent Sessions */}
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Historial de Evaluaciones</h2>

                {data.recentSessions.length === 0 ? (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>📝</div>
                        <h3 className={styles.emptyTitle}>Sin evaluaciones aún</h3>
                        <p className={styles.emptyText}>Completa un módulo para ver tu historial aquí.</p>
                    </div>
                ) : (
                    <div className={styles.sessionsList}>
                        {data.recentSessions.map((session, index) => (
                            <div
                                key={session.id}
                                className={styles.sessionItem}
                                style={{ animationDelay: `${index * 0.05}s` }}
                            >
                                <div className={styles.sessionLeft}>
                                    <div className={`${styles.sessionIcon} ${session.passed ? styles.passed : styles.failed}`}>
                                        {session.passed ? <CheckCircle size={16} /> : <XCircle size={16} />}
                                    </div>
                                    <div className={styles.sessionInfo}>
                                        <h3 className={styles.sessionTitle}>{session.moduleTitle}</h3>
                                        <span className={styles.sessionDate}>
                                            {session.completedAt?.toDate().toLocaleDateString('es-PE', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                </div>
                                <div className={styles.sessionRight}>
                                    <span className={`${styles.sessionScore} ${session.passed ? styles.passed : styles.failed}`}>
                                        {session.score}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
