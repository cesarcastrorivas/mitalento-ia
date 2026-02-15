'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { LearningPath, User } from '@/types';
import Link from 'next/link';
import styles from './page.module.css';

export default function StudentDashboard() {
    const { user } = useAuth();
    const [paths, setPaths] = useState<LearningPath[]>([]);
    const [loading, setLoading] = useState(true);

    // Saludo personalizado basado en la hora del día
    const greeting = useMemo(() => {
        // Usar zona horaria de Lima, Perú (UTC-5)
        const limaTime = new Date().toLocaleString('en-US', { timeZone: 'America/Lima', hour: 'numeric', hour12: false });
        const hour = parseInt(limaTime, 10);
        if (hour >= 5 && hour < 12) return { text: 'Buenos días', emoji: '☀️', period: 'morning' };
        if (hour >= 12 && hour < 18) return { text: 'Buenas tardes', emoji: '🌤️', period: 'afternoon' };
        return { text: 'Buenas noches', emoji: '🌙', period: 'evening' };
    }, []);

    // Extraer primer nombre
    const firstName = useMemo(() => {
        if (!user?.displayName) return '';
        return user.displayName.split(' ')[0];
    }, [user?.displayName]);

    // Frases motivacionales aleatorias
    const motivationalPhrase = useMemo(() => {
        const phrases = [
            'El éxito no es una opción, es tu obligación. ¡Acción masiva! 🔥',
            'No te conformes con lo promedio. Multiplica tus metas por 10X. 🚀',
            'Mientras otros duermen, tú estás construyendo un imperio. 💪',
            'La obsesión no es una enfermedad, es un don. ¡Úsalo! ⚡',
            'Los que dicen que es imposible nunca lo intentaron con todo. 🏆',
            'No necesitas suerte, necesitas acción masiva. ¡AHORA! 🎯',
            'Tu competencia debería preocuparse, no tú. Domina el juego. 👊',
            'El miedo es un indicador: estás a punto de crecer. ¡Hazlo! 💥',
            'Deja de pensar en pequeño. Piensa en GRANDE, actúa en GRANDE. 🦁',
            'No sigas el plan B. Haz que el plan A funcione con todo. 🔥',
        ];
        return phrases[Math.floor(Math.random() * phrases.length)];
    }, []);

    // Estados para progreso
    const [progressStats, setProgressStats] = useState({
        totalModules: 0,
        completedModules: 0,
        averageScore: 0,
        totalAttempts: 0,
        progressPercent: 0,
    });

    useEffect(() => {
        if (user) {
            loadPaths();
            loadProgressData();
        }
    }, [user]);

    const loadProgressData = async () => {
        try {
            if (!user?.uid) return;

            // 1. Total módulos activos
            const modulesQuery = query(collection(db, 'modules'), where('isActive', '==', true));
            const modulesSnapshot = await getDocs(modulesQuery);
            const totalModules = modulesSnapshot.size;

            // 2. Sesiones del usuario
            const sessionsQuery = query(
                collection(db, 'quiz_sessions'),
                where('userId', '==', user.uid)
            );
            const sessionsSnapshot = await getDocs(sessionsQuery);
            const sessions = sessionsSnapshot.docs.map(doc => doc.data() as any);

            // 3. Cálculos
            const passedModules = new Set();
            let totalScore = 0;

            sessions.forEach(session => {
                if (session.passed) passedModules.add(session.moduleId);
                totalScore += session.score;
            });

            const completedModules = passedModules.size;
            const averageScore = sessions.length > 0 ? Math.round(totalScore / sessions.length) : 0;
            const progressPercent = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

            setProgressStats({
                totalModules,
                completedModules,
                averageScore,
                totalAttempts: sessions.length,
                progressPercent,
            });

        } catch (error) {
            console.error('Error loading progress:', error);
        }
    };

    const loadPaths = async () => {
        try {
            if (!user) return;

            // Defensive check for user properties
            const assignedIds = user.assignedPathIds || [];
            const userRole = user.role || 'student';

            let pathsData: LearningPath[] = [];

            if (userRole === 'admin' || assignedIds.length === 0) {
                const q = query(
                    collection(db, 'learning_paths'),
                    where('isActive', '==', true)
                );
                const snapshot = await getDocs(q);
                pathsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LearningPath));
            } else {
                const q = query(
                    collection(db, 'learning_paths'),
                    where('isActive', '==', true)
                );
                const snapshot = await getDocs(q);
                const allPaths = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LearningPath));
                pathsData = allPaths.filter(p => assignedIds.includes(p.id));
            }

            pathsData.sort((a, b) => a.order - b.order);
            setPaths(pathsData);
        } catch (error) {
            console.error('Error loading paths:', error);
            // Si hay error de permisos, no bloqueamos la UI totalmente
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}></div>
                <p className={styles.loadingText}>Preparando tu experiencia...</p>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            {/* Hero Section con Saludo Personalizado */}
            <header className={styles.hero}>
                <div className={styles.heroBackground}>
                    <div className={styles.heroOrb1}></div>
                    <div className={styles.heroOrb2}></div>
                    <div className={styles.heroOrb3}></div>
                </div>
                <div className={styles.heroContent}>
                    <div className={styles.greetingRow}>
                        <span className={styles.greetingEmoji}>{greeting.emoji}</span>
                        <span className={styles.greetingLabel}>{greeting.text}</span>
                    </div>
                    <h1 className={styles.heroTitle}>
                        {firstName ? (
                            <>Hola, <span className={styles.heroName}>{firstName}</span></>
                        ) : (
                            'Bienvenido'
                        )}
                    </h1>
                    <p className={styles.heroSubtitle}>{motivationalPhrase}</p>

                    {/* Stats rápidos */}
                    <div className={styles.statsRow}>
                        <div className={styles.statCard}>
                            <span className={styles.statIcon}>🏆</span>
                            <div>
                                <span className={styles.statNumber}>{progressStats.progressPercent}%</span>
                                <span className={styles.statLabel}>Progreso Total</span>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statIcon}>📚</span>
                            <div>
                                <span className={styles.statNumber}>{progressStats.completedModules}/{progressStats.totalModules}</span>
                                <span className={styles.statLabel}>Módulos</span>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statIcon}>🎯</span>
                            <div>
                                <span className={styles.statNumber}>{progressStats.averageScore}%</span>
                                <span className={styles.statLabel}>Promedio</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Sección de Rutas */}
            <section className={styles.pathsSection}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Tus Rutas de Aprendizaje</h2>
                    <p className={styles.sectionSubtitle}>Selecciona un camino para continuar tu formación</p>
                </div>

                <div className={styles.pathsGrid}>
                    {paths.map((path, index) => (
                        <Link key={path.id} href={`/paths/${path.id}`} className={styles.pathLink} style={{ animationDelay: `${index * 0.1}s` }}>
                            <div className={styles.pathCard}>
                                <div className={styles.pathCardGlow}></div>
                                <div className={styles.pathIconWrapper} style={{
                                    background: [
                                        'linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%)',
                                        'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
                                        'linear-gradient(135deg, #6366F1 0%, #10B981 100%)',
                                        'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
                                    ][index % 4]
                                }}>
                                    <span className={styles.pathEmoji}>{path.icon || '🎓'}</span>
                                </div>
                                <div className={styles.pathBody}>
                                    <h3 className={styles.pathTitle}>{path.title}</h3>
                                    <p className={styles.pathDescription}>{path.description}</p>
                                </div>
                                <div className={styles.pathFooter}>
                                    <span className={styles.pathBadge}>Ruta de aprendizaje</span>
                                    <span className={styles.pathArrow}>
                                        Explorar <span>→</span>
                                    </span>
                                </div>
                            </div>
                        </Link>
                    ))}

                    {paths.length === 0 && (
                        <div className={styles.emptyState}>
                            <div className={styles.emptyIcon}>📭</div>
                            <h3 className={styles.emptyTitle}>No tienes rutas asignadas</h3>
                            <p className={styles.emptyText}>Contacta a tu administrador para que te asigne una ruta de aprendizaje.</p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
