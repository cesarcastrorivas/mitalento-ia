'use client';

import { useEffect, useState } from 'react';
import { collection, query, getDocs, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { User } from '@/types';
import styles from './page.module.css';
import { Trophy, Crown } from 'lucide-react';

interface RankedUser {
    uid: string;
    displayName: string;
    photoURL?: string;
    totalScore: number;
    passedModules: number;
    certificationLevel: string;
}

const LEVEL_LABELS: Record<string, string> = {
    none: 'En Proceso',
    fundamental: 'Fundamental',
    professional: 'Profesional',
    elite: 'Élite',
};

export default function LeaderboardPage() {
    const { user } = useAuth();
    const [ranked, setRanked] = useState<RankedUser[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadLeaderboard();
    }, []);

    const loadLeaderboard = async () => {
        try {
            // Get all students
            const usersQuery = query(
                collection(db, 'users'),
                where('role', '==', 'student')
            );
            const usersSnap = await getDocs(usersQuery);
            const users = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as User));

            // Get all quiz sessions
            const sessionsSnap = await getDocs(collection(db, 'quiz_sessions'));
            const sessions = sessionsSnap.docs.map(d => d.data());

            // Group sessions by user
            const userScores = new Map<string, { total: number; count: number; passedModules: Set<string> }>();

            sessions.forEach((s: any) => {
                if (!userScores.has(s.userId)) {
                    userScores.set(s.userId, { total: 0, count: 0, passedModules: new Set() });
                }
                const entry = userScores.get(s.userId)!;
                entry.total += s.score;
                entry.count += 1;
                if (s.passed) entry.passedModules.add(s.moduleId);
            });

            // Build ranked list
            const rankedList: RankedUser[] = users
                .map(u => {
                    const scores = userScores.get(u.uid);
                    return {
                        uid: u.uid,
                        displayName: u.displayName,
                        photoURL: u.photoURL,
                        totalScore: scores ? Math.round(scores.total / scores.count) : 0,
                        passedModules: scores ? scores.passedModules.size : 0,
                        certificationLevel: u.certificationLevel || 'none',
                    };
                })
                .filter(u => u.totalScore > 0)
                .sort((a, b) => b.totalScore - a.totalScore)
                .slice(0, 20);

            setRanked(rankedList);
        } catch (error) {
            console.error('Error loading leaderboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    if (loading) {
        return (
            <div className={styles.page}>
                <div className={styles.loading}>
                    <div className={styles.spinner} />
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Cargando ranking...</span>
                </div>
            </div>
        );
    }

    const top3 = ranked.slice(0, 3);
    const rest = ranked.slice(3);

    return (
        <div className={styles.page}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <h1 className={styles.title}>🏆 Ranking Urbanity Academy</h1>
                    <p className={styles.subtitle}>Top asesores en formación por puntaje promedio</p>
                </div>

                {ranked.length === 0 ? (
                    <div className={styles.empty}>
                        <div className={styles.emptyIcon}>🏅</div>
                        <h3>Sin datos aún</h3>
                        <p>Completa evaluaciones para aparecer en el ranking.</p>
                    </div>
                ) : (
                    <>
                        {/* Podium */}
                        {top3.length >= 3 && (
                            <div className={styles.podium}>
                                {/* 2nd place */}
                                <div className={`${styles.podiumItem} ${styles.second}`}>
                                    <div className={styles.podiumAvatar}>
                                        {getInitials(top3[1].displayName)}
                                        <span className={styles.podiumBadge}>🥈</span>
                                    </div>
                                    <span className={styles.podiumName}>{top3[1].displayName.split(' ')[0]}</span>
                                    <span className={styles.podiumScore}>{top3[1].totalScore}%</span>
                                    <div className={styles.podiumBase}>2</div>
                                </div>

                                {/* 1st place */}
                                <div className={`${styles.podiumItem} ${styles.first}`}>
                                    <div className={styles.podiumAvatar}>
                                        {getInitials(top3[0].displayName)}
                                        <span className={styles.podiumBadge}>👑</span>
                                    </div>
                                    <span className={styles.podiumName}>{top3[0].displayName.split(' ')[0]}</span>
                                    <span className={styles.podiumScore}>{top3[0].totalScore}%</span>
                                    <div className={styles.podiumBase}>1</div>
                                </div>

                                {/* 3rd place */}
                                <div className={`${styles.podiumItem} ${styles.third}`}>
                                    <div className={styles.podiumAvatar}>
                                        {getInitials(top3[2].displayName)}
                                        <span className={styles.podiumBadge}>🥉</span>
                                    </div>
                                    <span className={styles.podiumName}>{top3[2].displayName.split(' ')[0]}</span>
                                    <span className={styles.podiumScore}>{top3[2].totalScore}%</span>
                                    <div className={styles.podiumBase}>3</div>
                                </div>
                            </div>
                        )}

                        {/* Rest of the list */}
                        <div className={styles.list}>
                            {(top3.length < 3 ? ranked : rest).map((entry, i) => {
                                const position = top3.length < 3 ? i + 1 : i + 4;
                                const isMe = entry.uid === user?.uid;
                                return (
                                    <div
                                        key={entry.uid}
                                        className={styles.listItem}
                                        style={{
                                            animationDelay: `${i * 0.05}s`,
                                            ...(isMe ? { borderColor: 'rgba(99, 102, 241, 0.3)', background: 'rgba(99, 102, 241, 0.08)' } : {}),
                                        }}
                                    >
                                        <span className={styles.rank}>#{position}</span>
                                        <div className={styles.listAvatar}>
                                            {getInitials(entry.displayName)}
                                        </div>
                                        <div className={styles.listInfo}>
                                            <div className={styles.listName}>
                                                {entry.displayName} {isMe && '(Tú)'}
                                            </div>
                                            <div className={styles.listLevel}>
                                                {LEVEL_LABELS[entry.certificationLevel] || 'En Proceso'} · {entry.passedModules} módulos
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div className={styles.listScore}>{entry.totalScore}%</div>
                                            <div className={styles.listScoreLabel}>Promedio</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
