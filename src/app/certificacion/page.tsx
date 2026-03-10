'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Module, QuizSession, CertificationLevel } from '@/types';
import { FIXED_PATHS } from '@/lib/constants';
import Link from 'next/link';
import { GraduationCap, Lock, CheckCircle, Circle, Trophy, Target, Award, FileCheck, ArrowRight } from 'lucide-react';
import styles from './page.module.css';

interface DayConfig {
    level: CertificationLevel;
    dayNumber: number;
    title: string;
    subtitle: string;
    minScore: number;
    extraActions: { label: string; href: string; icon: string }[];
}

const DAYS: DayConfig[] = [
    {
        level: 'fundamental',
        dayNumber: 1,
        title: 'Cultura, Marco Legal y ADN Urbanity',
        subtitle: 'Evaluar mentalidad, comprensión del negocio y alineación cultural',
        minScore: 80,
        extraActions: [
            { label: 'Compromiso', href: '/compromiso', icon: '📜' },
        ],
    },
    {
        level: 'professional',
        dayNumber: 2,
        title: 'Método Comercial Urbanity',
        subtitle: 'Validar competencia comercial real',
        minScore: 85,
        extraActions: [],
    },
    {
        level: 'elite',
        dayNumber: 3,
        title: 'Alto Desempeño y Proyección a Liderazgo',
        subtitle: 'Identificar futuros líderes',
        minScore: 80,
        extraActions: [],
    },
];

const LEVEL_ORDER: CertificationLevel[] = ['none', 'fundamental', 'professional', 'elite'];

interface DayProgress {
    totalModules: number;
    completedModules: number;
    percent: number;
    isUnlocked: boolean;
    isCompleted: boolean;
    modules: { id: string; title: string; completed: boolean }[];
}

export default function CertificacionPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [userLevel, setUserLevel] = useState<CertificationLevel>('none');
    const [dayProgress, setDayProgress] = useState<Record<string, DayProgress>>({});

    useEffect(() => {
        if (user) loadProgress();
    }, [user]);

    const loadProgress = async () => {
        try {
            if (!user) return;

            // Get user's certification level
            const level = (user as any).certificationLevel || 'none';
            setUserLevel(level);

            // Get all active modules
            const modulesQuery = query(
                collection(db, 'modules'),
                where('isActive', '==', true)
            );
            const modulesSnap = await getDocs(modulesQuery);
            const allModules = modulesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Module));

            // Get all courses to map modules to paths
            const coursesSnap = await getDocs(collection(db, 'courses'));
            const courses = coursesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Usar rutas fijas para determine day/level
            const paths = FIXED_PATHS;

            // Get user's quiz sessions
            const sessionsQuery = query(
                collection(db, 'quiz_sessions'),
                where('userId', '==', user.uid)
            );
            const sessionsSnap = await getDocs(sessionsQuery);
            const sessions = sessionsSnap.docs.map(d => d.data() as QuizSession);

            // Build set of passed module IDs
            const passedModuleIds = new Set<string>();
            sessions.forEach(s => {
                if (s.passed) passedModuleIds.add(s.moduleId);
            });

            // Build progress per day (using path order as proxy for day)
            // Day 1 = paths with order 1, Day 2 = order 2, Day 3 = order 3
            // If no paths structure, distribute modules evenly
            const progress: Record<string, DayProgress> = {};
            const userLevelIndex = LEVEL_ORDER.indexOf(level);

            DAYS.forEach((day, i) => {
                // Get modules for this day based on path ordering
                const dayPaths = paths.filter((p: any) => p.order === i + 1);
                const dayPathIds = dayPaths.map((p: any) => p.id);
                const dayCourses = courses.filter((c: any) => dayPathIds.includes(c.pathId));
                const dayCourseIds = dayCourses.map((c: any) => c.id);
                const dayModules = allModules
                    .filter(m => dayCourseIds.includes(m.courseId))
                    .sort((a, b) => a.order - b.order);

                const completed = dayModules.filter(m => passedModuleIds.has(m.id)).length;
                const total = dayModules.length;

                // Unlock logic: Day 1 always unlocked, Day 2 requires fundamental, Day 3 requires professional
                const requiredLevelIndex = i; // Day 1 = index 0 -> needs 'none' (0), Day 2 = index 1 -> needs 'fundamental' (1)
                const isUnlocked = user.role === 'admin' || userLevelIndex >= requiredLevelIndex;

                progress[day.level] = {
                    totalModules: total,
                    completedModules: completed,
                    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
                    isUnlocked,
                    isCompleted: userLevelIndex > i,
                    modules: dayModules.map(m => ({
                        id: m.id,
                        title: m.title,
                        completed: passedModuleIds.has(m.id),
                    })),
                };
            });

            setDayProgress(progress);
        } catch (error) {
            console.error('Error loading certification progress:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className={styles.page}>
                <div className={styles.loading}>
                    <div className={styles.spinner} />
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Cargando certificación...</span>
                </div>
            </div>
        );
    }

    // Overall progress
    const totalModulesAll = Object.values(dayProgress).reduce((sum, d) => sum + d.totalModules, 0);
    const completedModulesAll = Object.values(dayProgress).reduce((sum, d) => sum + d.completedModules, 0);
    const overallPercent = totalModulesAll > 0 ? Math.round((completedModulesAll / totalModulesAll) * 100) : 0;

    return (
        <div className={styles.page}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.headerIcon}>
                        <GraduationCap size={32} color="white" />
                    </div>
                    <h1 className={styles.title}>Certificación Comercial</h1>
                    <p className={styles.subtitle}>3 días intensivos de alto estándar</p>
                </div>

                {/* Overall progress */}
                <div className={styles.overallProgress}>
                    <span className={styles.overallLabel}>Progreso General</span>
                    <div className={styles.overallBarTrack}>
                        <div
                            className={styles.overallBarFill}
                            style={{ width: `${overallPercent}%` }}
                        />
                    </div>
                    <span className={styles.overallPercent}>{overallPercent}%</span>
                </div>

                {/* Day Cards */}
                {DAYS.map((day) => {
                    const prog = dayProgress[day.level] || {
                        totalModules: 0, completedModules: 0, percent: 0,
                        isUnlocked: false, isCompleted: false, modules: [],
                    };

                    return (
                        <div
                            key={day.level}
                            className={`${styles.dayCard} ${styles[day.level]} ${!prog.isUnlocked ? styles.locked : ''}`}
                        >
                            <div className={styles.dayHeader}>
                                <span className={`${styles.dayBadge} ${styles[day.level]}`}>
                                    Día {day.dayNumber} · {day.level === 'fundamental' ? '🟢' : day.level === 'professional' ? '🟡' : '🔴'}
                                </span>
                                <span className={`${styles.dayStatus} ${prog.isCompleted ? styles.statusCompleted :
                                    prog.isUnlocked ? styles.statusInProgress : styles.statusLocked
                                    }`}>
                                    {prog.isCompleted ? (
                                        <><CheckCircle size={14} /> Completado</>
                                    ) : prog.isUnlocked ? (
                                        <><Circle size={14} /> En Progreso</>
                                    ) : (
                                        <><Lock size={14} /> Bloqueado</>
                                    )}
                                </span>
                            </div>

                            <h3 className={styles.dayTitle}>{day.title}</h3>
                            <p className={styles.daySubtitle}>{day.subtitle} · Mínimo {day.minScore}%</p>

                            {/* Progress bar */}
                            <div className={styles.dayProgress}>
                                <div className={styles.dayBarTrack}>
                                    <div
                                        className={`${styles.dayBarFill} ${styles[day.level]}`}
                                        style={{ width: `${prog.percent}%` }}
                                    />
                                </div>
                                <span className={styles.dayPercent}>{prog.percent}%</span>
                            </div>

                            {/* Module list */}
                            {prog.isUnlocked && prog.modules.length > 0 && (
                                <div className={styles.moduleList}>
                                    {prog.modules.slice(0, 5).map(m => (
                                        <Link
                                            key={m.id}
                                            href={`/modules/${m.id}`}
                                            className={styles.moduleItem}
                                        >
                                            <span className={`${styles.moduleIcon} ${m.completed ? styles.moduleCompleted : styles.modulePending}`}>
                                                {m.completed ? <CheckCircle size={16} /> : <Circle size={16} />}
                                            </span>
                                            {m.title}
                                        </Link>
                                    ))}
                                    {prog.modules.length > 5 && (
                                        <span className={styles.moduleItem} style={{ justifyContent: 'center', color: 'rgba(255,255,255,0.4)' }}>
                                            +{prog.modules.length - 5} módulos más
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Actions */}
                            {prog.isUnlocked ? (
                                <div className={styles.dayActions}>
                                    {day.extraActions.map(action => (
                                        <Link key={action.href} href={action.href} className={`${styles.dayActionBtn} ${styles.secondary}`}>
                                            {action.icon} {action.label}
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className={styles.lockOverlay}>
                                    <Lock size={16} /> Completa el día anterior para desbloquear
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Quick actions */}
                <div className={styles.quickActions}>
                    <Link href="/leaderboard" className={styles.quickActionCard}>
                        <div className={styles.quickActionIcon}>🏆</div>
                        <div className={styles.quickActionLabel}>Ranking</div>
                    </Link>
                    <Link href="/certificate" className={styles.quickActionCard}>
                        <div className={styles.quickActionIcon}>🎖️</div>
                        <div className={styles.quickActionLabel}>Certificado</div>
                    </Link>
                    <Link href="/progress" className={styles.quickActionCard}>
                        <div className={styles.quickActionIcon}>📊</div>
                        <div className={styles.quickActionLabel}>Mi Progreso</div>
                    </Link>
                </div>
            </div>
        </div>
    );
}
