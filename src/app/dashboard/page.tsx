import { getAdminDb } from '@/lib/firebase-admin';
import { getServerUser } from '@/lib/server-auth';
import { LearningPath, User, Certificate, Course } from '@/types';
import { FIXED_PATHS } from '@/lib/constants';
import Link from 'next/link';
import { Award, BookOpen, Crown, Building2, LineChart, Sun, CloudSun, Moon, Trophy, Layers, Route, ArrowRight, TrendingUp, ChevronRight } from 'lucide-react';
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
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-28 pb-32 space-y-8 sm:space-y-10 font-sans animate-fade-in scroll-smooth">
            
            {/* Hero Section */}
            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-primary/80 mb-2">
                            {greeting.type === 'morning' && <Sun size={20} strokeWidth={2.5} className="text-amber-500" />}
                            {greeting.type === 'afternoon' && <CloudSun size={20} strokeWidth={2.5} className="text-amber-500" />}
                            {greeting.type === 'evening' && <Moon size={20} strokeWidth={2.5} className="text-indigo-400" />}
                            <span className="font-label text-xs font-bold uppercase tracking-wider">{greeting.text}</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-on-surface">
                            {firstName ? `Hola, ${firstName}.` : 'Bienvenido.'}
                        </h1>
                        <div className="text-on-surface-variant text-sm font-medium italic mt-2">
                            <MotivationalPhrase />
                        </div>
                    </div>
                </div>

                {/* Stats Bento Grid */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-6 max-w-2xl">
                    <div className="col-span-2 bg-white p-5 sm:p-6 rounded-[2rem] card-premium relative overflow-hidden">
                        <div className="relative z-10 flex justify-between items-end">
                            <div className="space-y-1">
                                <span className="text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-widest">Progreso Total</span>
                                <div className="text-4xl sm:text-5xl font-extrabold tracking-tighter leading-none mt-1 text-primary">{progressStats.progressPercent}%</div>
                            </div>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-50 rounded-full flex items-center justify-center text-primary">
                                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.5} />
                            </div>
                        </div>
                        <div className="mt-6 sm:mt-8 flex items-center gap-3">
                            <div className="flex-1 h-2 bg-purple-100 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full transition-all duration-1000 ease-out" style={{ width: `${progressStats.progressPercent}%` }}></div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white p-4 sm:p-5 rounded-[1.5rem] sm:rounded-3xl card-premium flex flex-col justify-between min-h-[110px] sm:min-h-[120px]">
                        <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-[#6f46b9] mb-3" strokeWidth={2} />
                        <div>
                            <div className="text-xl sm:text-2xl font-bold text-on-surface">{progressStats.completedModules}/{progressStats.totalModules}</div>
                            <div className="text-[10px] font-bold uppercase text-on-surface-variant tracking-wider">Módulos</div>
                        </div>
                    </div>
                    <div className="bg-white p-4 sm:p-5 rounded-[1.5rem] sm:rounded-3xl card-premium flex flex-col justify-between min-h-[110px] sm:min-h-[120px]">
                        <Route className="w-5 h-5 sm:w-6 sm:h-6 text-[#849244] mb-3" strokeWidth={2} />
                        <div>
                            <div className="text-xl sm:text-2xl font-bold text-on-surface">{progressStats.routesCompleted}/{progressStats.totalRoutes}</div>
                            <div className="text-[10px] font-bold uppercase text-on-surface-variant tracking-wider">Rutas</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Learning Routes */}
            <section className="space-y-5 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xl font-bold text-on-surface">Tus Rutas de Aprendizaje</h2>
                    <span className="text-[#471e52] text-xs font-bold hidden sm:block">Ver todas</span>
                </div>

                <div className="flex overflow-x-auto pb-6 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
                    {paths.map((path, index) => {
                        const IconComponent = PATH_ICONS[path.id] || BookOpen;
                        const isMandatory = FIXED_PATHS.some(fp => fp.id === path.id);
                        
                        return (
                            <Link 
                                key={path.id} 
                                href={`/paths/${path.id}`} 
                                className="group flex-none w-[85vw] sm:w-auto block focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 rounded-3xl snap-center sm:snap-align-none"
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                <div className="bg-white p-5 sm:p-6 rounded-3xl card-premium space-y-4 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_36px_rgba(0,0,0,0.08)] h-full flex flex-col">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="p-3 bg-purple-100/50 rounded-xl text-[#471e52]">
                                            <IconComponent size={24} strokeWidth={2} />
                                        </div>
                                        <span className={`px-3 py-1 text-[10px] font-extrabold rounded-full uppercase tracking-tighter ${
                                            isMandatory 
                                            ? 'bg-[#f5a944] text-white' 
                                            : 'bg-gray-100 text-gray-600'
                                        }`}>
                                            {isMandatory ? 'Esencial' : 'Especialización'}
                                        </span>
                                    </div>
                                    
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-on-surface">{path.title}</h3>
                                        <p className="text-on-surface-variant text-sm mt-1 mb-4 leading-relaxed line-clamp-2">
                                            {path.description}
                                        </p>
                                    </div>
                                    
                                    <button className="w-full bg-[#471e52] text-white py-3 rounded-xl font-bold text-sm shadow-sm transition-all active:scale-95 group-hover:bg-[#60356a]">
                                        Explorar ruta
                                    </button>
                                    
                                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none transition-transform duration-500 group-hover:scale-110">
                                        <IconComponent size={120} strokeWidth={1.5} />
                                    </div>
                                </div>
                            </Link>
                        );
                    })}

                    {paths.length === 0 && (
                        <div className="col-span-full p-8 bg-white rounded-3xl border border-outline-variant/15 flex flex-col items-center justify-center text-center py-16">
                            <div className="w-16 h-16 rounded-full bg-gray-50 mb-4 flex items-center justify-center">
                                <Route className="w-8 h-8 text-gray-400" strokeWidth={1.5} />
                            </div>
                            <h3 className="text-lg font-bold text-on-surface mb-2">Aún no hay rutas</h3>
                            <p className="text-on-surface-variant text-sm max-w-sm mx-auto">Contacta a un administrador para que asigne tu camino de aprendizaje.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* Certificates Section */}
            {certificates.length > 0 && (
                <section className="space-y-4 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xl font-bold text-on-surface">Logros Alcanzados</h2>
                    </div>

                    <div className="flex overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
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
                                    className="block flex-none w-[85vw] sm:w-auto group focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 rounded-3xl snap-center sm:snap-align-none"
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    <div className="bg-gray-50/80 p-4 rounded-[1.5rem] flex items-center gap-4 border border-outline-variant/10 transition-all hover:bg-white hover:shadow-sm">
                                        <div className="w-14 h-14 bg-white rounded-full flex shrink-0 items-center justify-center shadow-sm text-[#2a3300]">
                                            <Award size={28} strokeWidth={2} className="fill-current text-[#404c03]" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-center gap-2">
                                                <h4 className="font-bold text-on-surface text-sm truncate">
                                                    {cert.pathTitle || LEVEL_LABELS[cert.level] || 'Certificado'}
                                                </h4>
                                                <span className="text-[10px] font-bold text-[#acbb69] uppercase shrink-0">
                                                    {cert.score}% SCORE
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <span className="text-xs text-on-surface-variant font-medium">Acreditado</span>
                                                <div className="h-1 w-1 bg-outline-variant rounded-full shrink-0"></div>
                                                <span className="text-[#471e52] text-xs font-bold truncate">Ver credencial</span>
                                            </div>
                                        </div>
                                        <div className="text-outline-variant group-hover:text-primary transition-colors pr-2 shrink-0">
                                            <ChevronRight size={20} strokeWidth={2} />
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

