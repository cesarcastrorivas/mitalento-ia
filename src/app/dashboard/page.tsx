import { getAdminDb } from '@/lib/firebase-admin';
import { getServerUser } from '@/lib/server-auth';
import { LearningPath, User, Certificate, Course } from '@/types';
import { FIXED_PATHS } from '@/lib/constants';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import styles from './page.module.css';
import { Award } from 'lucide-react';

export default async function StudentDashboard() {
    const userClaims = await getServerUser();
    if (!userClaims) {
        // Return null instead of redirecting; DashboardGuard in layout.tsx will handle the redirect.
        return null;
    }

    const uid = userClaims.uid;
    const db = getAdminDb();

    // 1. Fetch user data
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() as User : null;

    // 2. Determine paths
    const assignedIds = userData?.assignedPathIds || [];
    const allPathIds = [...FIXED_PATHS.map(p => p.id), ...assignedIds];
    const uniquePathIds = [...new Set(allPathIds)];

    // 3. Prepare all parallel queries
    let pathsPromise = Promise.resolve([] as any[]);
    if (assignedIds.length > 0) {
        // firebase-admin 'in' query works up to 10 elements. Assuming assignedIds < 10.
        pathsPromise = db.collection('learning_paths').where('__name__', 'in', assignedIds).get()
            .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }

    const certsPromise = db.collection('certificates').where('userId', '==', uid).where('isActive', '==', true).get()
        .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as Certificate)));

    // Filter courses only from the user's assigned paths (Firestore 'in' supports up to 30 values)
    const pathIdsToQuery = uniquePathIds.slice(0, 30);
    const coursesPromise = pathIdsToQuery.length > 0
        ? db.collection('courses')
            .where('pathId', 'in', pathIdsToQuery)
            .where('isActive', '==', true)
            .get()
            .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as Course)))
        : Promise.resolve([] as Course[]);

    const sessionsPromise = db.collection('quiz_sessions').where('userId', '==', uid).get()
        .then(snap => snap.docs.map(d => d.data() as any));

    // 4. Execute independent queries in parallel
    const [dynamicPaths, certs, allCourses, sessions] = await Promise.all([
        pathsPromise,
        certsPromise,
        coursesPromise,
        sessionsPromise,
    ]);

    // 4b. Fetch modules filtered by the user's course IDs (depends on allCourses)
    const courseIds = allCourses.map((c: Course) => c.id).slice(0, 30);
    const allModules = courseIds.length > 0
        ? await db.collection('modules')
            .where('courseId', 'in', courseIds)
            .where('isActive', '==', true)
            .get()
            .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as any)))
        : [];

    // 5. Process Paths
    const paths = [...FIXED_PATHS, ...dynamicPaths as LearningPath[]]
        .sort((a, b) => (a.order || 99) - (b.order || 99));
    const certificates = certs;

    // 6. Process Progress Data
    const totalRoutes = uniquePathIds.length;
    const routesCompleted = (userData?.completedPaths || []).length;

    // Courses and modules are already filtered server-side by pathId/courseId
    const totalModules = allModules.length;

    const passedModules = new Set<string>();
    const bestScorePerModule = new Map<string, number>();

    sessions.forEach((session: any) => {
        if (session.passed) passedModules.add(session.moduleId);
        const current = bestScorePerModule.get(session.moduleId) || 0;
        if (session.score > current) {
            bestScorePerModule.set(session.moduleId, session.score);
        }
    });

    const completedModules = passedModules.size;
    const bestScores = Array.from(bestScorePerModule.values());
    const averageScore = bestScores.length > 0
        ? Math.round(bestScores.reduce((sum, s) => sum + s, 0) / bestScores.length)
        : 0;
    const progressPercent = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

    const progressStats = {
        totalModules,
        completedModules,
        averageScore,
        totalAttempts: sessions.length,
        progressPercent,
        routesCompleted,
        totalRoutes,
    };

    // Saludo estático según hora de servidor
    const getGreeting = () => {
        const limaTime = new Date().toLocaleString('en-US', { timeZone: 'America/Lima', hour: 'numeric', hour12: false });
        const hour = parseInt(limaTime, 10);
        if (hour >= 5 && hour < 12) return { text: 'Buenos días', emoji: '☀️' };
        if (hour >= 12 && hour < 18) return { text: 'Buenas tardes', emoji: '🌤️' };
        return { text: 'Buenas noches', emoji: '🌙' };
    };
    const greeting = getGreeting();

    const firstName = (userClaims as any).name ? (userClaims as any).name.split(' ')[0] : (userData?.displayName?.split(' ')[0] || '');

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
    const motivationalPhrase = phrases[Math.floor(Math.random() * phrases.length)];

    return (
        <div className={styles.page}>
            {/* Hero Section */}
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
                            <span className={styles.statIcon}>🛤️</span>
                            <div>
                                <span className={styles.statNumber}>{progressStats.routesCompleted}/{progressStats.totalRoutes}</span>
                                <span className={styles.statLabel}>Rutas</span>
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
                                    <span className={`${styles.pathBadge} ${!FIXED_PATHS.some(fp => fp.id === path.id) ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : ''}`}>
                                        {FIXED_PATHS.some(fp => fp.id === path.id) ? 'Ruta obligatoria' : 'Especialización'}
                                    </span>
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

            {/* Sección de Certificados */}
            {certificates.length > 0 && (
                <section className={styles.pathsSection}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>Mis Certificados</h2>
                        <p className={styles.sectionSubtitle}>
                            {certificates.length} certificado{certificates.length !== 1 ? 's' : ''} obtenido{certificates.length !== 1 ? 's' : ''}
                        </p>
                    </div>

                    <div className={styles.pathsGrid}>
                        {certificates.map((cert, index) => {
                            const CERT_COLORS: Record<string, string> = {
                                fundamental: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                professional: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                elite: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            };
                            const LEVEL_LABELS: Record<string, string> = {
                                fundamental: 'Nivel Fundamental',
                                professional: 'Nivel Profesional',
                                elite: 'Nivel Élite',
                            };
                            return (
                                <Link key={cert.id} href="/certificate" className={styles.pathLink} style={{ animationDelay: `${index * 0.1}s` }}>
                                    <div className={styles.pathCard}>
                                        <div className={styles.pathCardGlow}></div>
                                        <div className={styles.pathIconWrapper} style={{
                                            background: CERT_COLORS[cert.level] || CERT_COLORS.fundamental
                                        }}>
                                            <span className={styles.pathEmoji}>🏅</span>
                                        </div>
                                        <div className={styles.pathBody}>
                                            <h3 className={styles.pathTitle}>
                                                {cert.pathTitle || LEVEL_LABELS[cert.level] || 'Certificado'}
                                            </h3>
                                            <p className={styles.pathDescription}>
                                                {LEVEL_LABELS[cert.level] || 'Certificado'} • Puntaje: {cert.score}%
                                            </p>
                                        </div>
                                        <div className={styles.pathFooter}>
                                            <span className={styles.pathBadge} style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                                                ✓ Certificado
                                            </span>
                                            <span className={styles.pathArrow}>
                                                Ver <span>→</span>
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </section>
            )}
        </div>
    );
}
