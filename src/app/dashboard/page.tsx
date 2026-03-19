import { getAdminDb } from '@/lib/firebase-admin';
import { getServerUser } from '@/lib/server-auth';
import { LearningPath, User, Certificate, Course } from '@/types';
import { FIXED_PATHS } from '@/lib/constants';
import Link from 'next/link';
import { Award, BookOpen, Crown, Building2, LineChart, Sun, CloudSun, Moon, Trophy, Layers, Route, ArrowRight } from 'lucide-react';
import { MotivationalPhrase } from '@/components/MotivationalPhrase';

const PATH_ICONS: Record<string, any> = {
    'path-fundamental': Building2,
    'path-professional': LineChart,
    'path-elite': Crown,
};

export default async function StudentDashboard() {
    const userClaims = await getServerUser();
    if (!userClaims) {
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
        pathsPromise = db.collection('learning_paths').where('__name__', 'in', assignedIds).get()
            .then((snap: any) => snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
    }

    const certsPromise = db.collection('certificates').where('userId', '==', uid).where('isActive', '==', true).get()
        .then((snap: any) => snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Certificate)));

    // Filter courses only from the user's assigned paths
    const pathIdsToQuery = uniquePathIds.slice(0, 30);
    const coursesPromise = pathIdsToQuery.length > 0
        ? db.collection('courses')
            .where('pathId', 'in', pathIdsToQuery)
            .where('isActive', '==', true)
            .get()
            .then((snap: any) => snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Course)))
        : Promise.resolve([] as Course[]);

    const sessionsPromise = db.collection('quiz_sessions')
        .where('userId', '==', uid)
        .orderBy('completedAt', 'desc')
        .limit(200)
        .get()
        .then((snap: any) => snap.docs.map((d: any) => d.data() as any));

    // 4. Execute independent queries in parallel
    const [dynamicPaths, certs, allCourses, sessions] = await Promise.all([
        pathsPromise,
        certsPromise,
        coursesPromise,
        sessionsPromise,
    ]);

    // 4b. Fetch modules filtered by the user's course IDs
    const courseIds = allCourses.map((c: Course) => c.id).slice(0, 30);
    const allModules = courseIds.length > 0
        ? await db.collection('modules')
            .where('courseId', 'in', courseIds)
            .where('isActive', '==', true)
            .get()
            .then((snap: any) => snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as any)))
        : [];

    // 5. Process Paths
    const paths = [...FIXED_PATHS, ...dynamicPaths as LearningPath[]]
        .sort((a, b) => (a.order || 99) - (b.order || 99));
    const certificates = certs;

    // 6. Process Progress Data
    const totalRoutes = uniquePathIds.length;
    const routesCompleted = (userData?.completedPaths || []).length;

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

    const getGreeting = () => {
        const limaTime = new Date().toLocaleString('en-US', { timeZone: 'America/Lima', hour: 'numeric', hour12: false });
        const hour = parseInt(limaTime, 10);
        if (hour >= 5 && hour < 12) return { text: 'Buenos días', type: 'morning' };
        if (hour >= 12 && hour < 18) return { text: 'Buenas tardes', type: 'afternoon' };
        return { text: 'Buenas noches', type: 'evening' };
    };
    const greeting = getGreeting();
    const firstName = (userClaims as any).name ? (userClaims as any).name.split(' ')[0] : (userData?.displayName?.split(' ')[0] || '');

    return (
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12 pb-24 font-sans text-on-surface animate-fade-in scroll-smooth">
            
            {/* Hero Section */}
            <header className="relative w-full rounded-[2.5rem] bg-surface-dim overflow-hidden p-8 lg:p-12 border border-outline-variant/20 shadow-sm isolate">
                {/* Atmospheric decoration */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-primary/5 blur-[100px] -z-10 pointer-events-none" />
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-secondary/5 blur-[100px] -z-10 pointer-events-none" />

                <div className="max-w-3xl mb-10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-surface-container-lowest flex items-center justify-center shadow-sm border border-outline-variant/10 text-primary">
                            {greeting.type === 'morning' && <Sun size={20} strokeWidth={2} />}
                            {greeting.type === 'afternoon' && <CloudSun size={20} strokeWidth={2} />}
                            {greeting.type === 'evening' && <Moon size={20} strokeWidth={2} />}
                        </div>
                        <span className="text-label-md text-secondary font-bold tracking-widest uppercase">{greeting.text}</span>
                    </div>
                    
                    <h1 className="text-display-md text-on-surface mb-4">
                        {firstName ? (
                            <>Hola, <span className="font-light">{firstName}</span></>
                        ) : (
                            'Bienvenido'
                        )}
                    </h1>
                    <div className="text-body-lg text-outline-variant font-medium max-w-2xl leading-relaxed">
                        <MotivationalPhrase />
                    </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="card-premium bg-surface-container-lowest p-6 flex items-center gap-5 border border-outline-variant/10 group">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                            <Trophy size={26} strokeWidth={1.5} />
                        </div>
                        <div>
                            <span className="block text-3xl font-extrabold text-on-surface leading-none tracking-tight mb-1">
                                {progressStats.progressPercent}%
                            </span>
                            <span className="text-label-md text-secondary">Progreso Total</span>
                        </div>
                    </div>
                    
                    <div className="card-premium bg-surface-container-lowest p-6 flex items-center gap-5 border border-outline-variant/10 group">
                        <div className="w-14 h-14 rounded-2xl bg-primary-container/40 text-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                            <Layers size={26} strokeWidth={1.5} />
                        </div>
                        <div>
                            <span className="block text-3xl font-extrabold text-on-surface leading-none tracking-tight mb-1">
                                {progressStats.completedModules} <span className="text-outline-variant/50 text-xl">/ {progressStats.totalModules}</span>
                            </span>
                            <span className="text-label-md text-secondary">Módulos</span>
                        </div>
                    </div>

                    <div className="card-premium bg-surface-container-lowest p-6 flex items-center gap-5 border border-outline-variant/10 group">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                            <Route size={26} strokeWidth={1.5} />
                        </div>
                        <div>
                            <span className="block text-3xl font-extrabold text-on-surface leading-none tracking-tight mb-1">
                                {progressStats.routesCompleted} <span className="text-outline-variant/50 text-xl">/ {progressStats.totalRoutes}</span>
                            </span>
                            <span className="text-label-md text-secondary">Rutas</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Paths Section */}
            <section className="space-y-8 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-display-sm text-on-surface mb-2">Tus Rutas de Aprendizaje</h2>
                        <p className="text-body-lg text-secondary">Trazando el camino hacia la excelencia profesional.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {paths.map((path, index) => {
                        const IconComponent = PATH_ICONS[path.id] || BookOpen;
                        const isMandatory = FIXED_PATHS.some(fp => fp.id === path.id);
                        
                        return (
                            <Link 
                                key={path.id} 
                                href={`/paths/${path.id}`} 
                                className="group block focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 rounded-[2rem]"
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                <div className="card-premium h-full bg-surface-container-lowest flex flex-col p-8 border border-outline-variant/10 hover:border-primary/20 transition-all duration-500 hover:-translate-y-1">
                                    <div className="flex justify-between items-start mb-10">
                                        <div className="w-16 h-16 rounded-[1.25rem] bg-surface-dim text-primary flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:bg-primary-container/30">
                                            <IconComponent size={32} strokeWidth={1.5} />
                                        </div>
                                        <div className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                                            isMandatory 
                                            ? 'bg-secondary-container/50 text-secondary border border-secondary/10' 
                                            : 'bg-surface-dim text-outline-variant border border-outline-variant/10'
                                        }`}>
                                            {isMandatory ? 'Esencial' : 'Especialización'}
                                        </div>
                                    </div>
                                    
                                    <h3 className="text-headline-sm text-on-surface mb-3 group-hover:text-primary transition-colors">{path.title}</h3>
                                    <p className="text-body-md text-secondary leading-relaxed mb-6 flex-1 line-clamp-3">
                                        {path.description}
                                    </p>
                                    
                                    <div className="pt-6 border-t border-outline-variant/10 flex items-center justify-between mt-auto">
                                        <span className="text-label-md text-outline-variant font-medium">Explorar ruta</span>
                                        <div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface group-hover:bg-primary group-hover:text-white transition-all duration-300">
                                            <ArrowRight size={20} strokeWidth={2} />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}

                    {paths.length === 0 && (
                        <div className="col-span-full py-20 card-premium bg-surface-dim border border-dashed border-outline-variant/20 flex flex-col items-center justify-center text-center">
                            <div className="w-20 h-20 rounded-full bg-surface-container-lowest mb-6 flex items-center justify-center shadow-sm">
                                <Route className="w-8 h-8 text-outline-variant" strokeWidth={1.5} />
                            </div>
                            <h3 className="text-headline-sm text-on-surface mb-2">Aún no hay rutas</h3>
                            <p className="text-body-lg text-secondary max-w-md mx-auto">Contacta a un administrador para que asigne tu camino de aprendizaje.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* Certificates Section */}
            {certificates.length > 0 && (
                <section className="space-y-8 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-8 border-t border-outline-variant/10">
                        <div>
                            <h2 className="text-display-sm text-on-surface mb-2">Logros Alcanzados</h2>
                            <p className="text-body-lg text-secondary">Reconocimiento a tu esfuerzo y dedicación.</p>
                        </div>
                        <div className="px-4 py-2 rounded-xl bg-surface-dim border border-outline-variant/10 text-label-md text-secondary font-medium">
                            {certificates.length} Certificado{certificates.length !== 1 ? 's' : ''}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {certificates.map((cert: any, index: number) => {
                            const LEVEL_LABELS: Record<string, string> = {
                                fundamental: 'Nivel Fundamental',
                                professional: 'Nivel Profesional',
                                elite: 'Nivel Élite',
                            };
                            return (
                                <Link 
                                    key={cert.id} 
                                    href="/certificate" 
                                    className="group block focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20 rounded-[2rem]"
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    <div className="card-premium h-full bg-surface-container-lowest flex flex-col p-8 border border-outline-variant/10 hover:border-emerald-500/30 transition-all duration-500 hover:-translate-y-1">
                                        <div className="flex justify-between items-start mb-8">
                                            <div className="w-16 h-16 rounded-[1.25rem] bg-emerald-500/10 text-emerald-600 flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:shadow-[0_4px_20px_rgba(16,185,129,0.2)]">
                                                <Award size={32} strokeWidth={1.5} />
                                            </div>
                                            <div className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                                                Acreditado
                                            </div>
                                        </div>
                                        
                                        <h3 className="text-headline-sm text-on-surface mb-2">
                                            {cert.pathTitle || LEVEL_LABELS[cert.level] || 'Certificado'}
                                        </h3>
                                        <p className="text-body-md text-secondary mb-6 flex-1">
                                            {LEVEL_LABELS[cert.level] || 'Certificado'}
                                        </p>
                                        
                                        <div className="pt-6 border-t border-outline-variant/10 flex items-center justify-between mt-auto">
                                            <span className="text-label-md text-emerald-600 font-bold">Ver credencial</span>
                                            <div className="w-24 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-700 font-bold group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                                                {cert.score}%
                                            </div>
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

