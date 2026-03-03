'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import styles from './page.module.css';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
// eslint-disable-next-line @next/next/no-img-element
import type { LeaderboardEntry } from '@/app/api/leaderboard/route';

const LEVEL_LABELS: Record<string, string> = {
    none: 'En Proceso',
    fundamental: 'Fundamental',
    professional: 'Profesional',
    elite: 'Élite',
};

export default function LeaderboardPage() {
    const { user } = useAuth();
    const [ranked, setRanked] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadLeaderboard();
    }, []);

    const loadLeaderboard = async () => {
        try {
            // Server-side API: computes ranking with Admin SDK, returns only needed fields.
            // No raw Firestore reads from the client — no quiz_sessions data exposed.
            const res = await fetch('/api/leaderboard');
            if (!res.ok) throw new Error('Error al cargar el leaderboard');
            const data = await res.json();
            setRanked(data.ranked ?? []);
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
                <div className={styles.topNav}>
                    <Link href="/dashboard" className={styles.backBtn}>
                        <ArrowLeft size={20} />
                        <span>Volver</span>
                    </Link>
                </div>

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
                                        {top3[1].photoURL ? (
                                            <img src={top3[1].photoURL} alt={top3[1].displayName} className={styles.avatarImg} />
                                        ) : (
                                            getInitials(top3[1].displayName)
                                        )}
                                        <span className={styles.podiumBadge}>🥈</span>
                                    </div>
                                    <span className={styles.podiumName}>{top3[1].displayName.split(' ')[0]}</span>
                                    <span className={styles.podiumScore}>{top3[1].totalScore}%</span>
                                    <div className={styles.podiumBase}>2</div>
                                </div>

                                {/* 1st place */}
                                <div className={`${styles.podiumItem} ${styles.first}`}>
                                    <div className={styles.podiumAvatar}>
                                        {top3[0].photoURL ? (
                                            <img src={top3[0].photoURL} alt={top3[0].displayName} className={styles.avatarImg} />
                                        ) : (
                                            getInitials(top3[0].displayName)
                                        )}
                                        <span className={styles.podiumBadge}>👑</span>
                                    </div>
                                    <span className={styles.podiumName}>{top3[0].displayName.split(' ')[0]}</span>
                                    <span className={styles.podiumScore}>{top3[0].totalScore}%</span>
                                    <div className={styles.podiumBase}>1</div>
                                </div>

                                {/* 3rd place */}
                                <div className={`${styles.podiumItem} ${styles.third}`}>
                                    <div className={styles.podiumAvatar}>
                                        {top3[2].photoURL ? (
                                            <img src={top3[2].photoURL} alt={top3[2].displayName} className={styles.avatarImg} />
                                        ) : (
                                            getInitials(top3[2].displayName)
                                        )}
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
                                            {entry.photoURL ? (
                                                <img src={entry.photoURL} alt={entry.displayName} className={styles.avatarImg} />
                                            ) : (
                                                getInitials(entry.displayName)
                                            )}
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
