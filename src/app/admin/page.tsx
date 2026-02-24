'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from '@/types';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
    Users,
    GraduationCap,
    ArrowRight,
    Layout,
    BookOpen,
    Award,
    ClipboardList,
    Target,
    CheckCircle,
    XCircle,
    Clock,
    MoreHorizontal
} from 'lucide-react';

interface RecentActivity {
    id: string;
    type: 'quiz' | 'evaluation';
    studentName: string;
    detail: string;
    score?: number;
    passed?: boolean;
    timestamp: Date;
}

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        activeStudents: 0,
        certificationRate: 0,
        pendingEvaluations: 0,
        averageScore: 0,
    });
    const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            // 1. Estudiantes activos
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const users = usersSnapshot.docs.map(d => ({ uid: d.id, ...d.data() } as User));
            const students = users.filter(u => u.role === 'student');
            const activeStudents = students.filter(u => u.isActive).length;

            // 2. Tasa de certificación
            const certsSnapshot = await getDocs(
                query(collection(db, 'certificates'), where('isActive', '==', true))
            );
            const totalCerts = certsSnapshot.size;
            const certificationRate = activeStudents > 0
                ? Math.round((totalCerts / activeStudents) * 100)
                : 0;

            // 3. Evaluaciones pendientes
            const evalsSnapshot = await getDocs(
                query(collection(db, 'attitudinal_evaluations'), where('semaphore', '==', 'pending'))
            );
            const pendingEvaluations = evalsSnapshot.size;

            // 4. Promedio general de scores
            const sessionsSnapshot = await getDocs(collection(db, 'quiz_sessions'));
            const sessions = sessionsSnapshot.docs.map(d => d.data());
            let totalScore = 0;
            sessions.forEach((s: any) => {
                totalScore += s.score || 0;
            });
            const averageScore = sessions.length > 0
                ? Math.round(totalScore / sessions.length)
                : 0;

            setStats({
                activeStudents,
                certificationRate,
                pendingEvaluations,
                averageScore,
            });

            // 5. Actividad reciente (últimas quiz sessions)
            // Build a user map for names
            const userMap = new Map<string, string>();
            users.forEach(u => userMap.set(u.uid, u.displayName));

            const activities: RecentActivity[] = [];

            // Recent quiz sessions
            const recentSessions = sessionsSnapshot.docs
                .map(d => ({ id: d.id, ...d.data() } as any))
                .filter(s => s.completedAt)
                .sort((a: any, b: any) => {
                    const ta = a.completedAt?.toDate?.() || new Date(0);
                    const tb = b.completedAt?.toDate?.() || new Date(0);
                    return tb.getTime() - ta.getTime();
                })
                .slice(0, 5);

            recentSessions.forEach((s: any) => {
                activities.push({
                    id: s.id,
                    type: 'quiz',
                    studentName: userMap.get(s.userId) || 'Estudiante',
                    detail: `Quiz completado — ${s.score}%`,
                    score: s.score,
                    passed: s.passed,
                    timestamp: s.completedAt?.toDate?.() || new Date(),
                });
            });

            // Recent evaluations
            const evalsAllSnapshot = await getDocs(collection(db, 'attitudinal_evaluations'));
            const recentEvals = evalsAllSnapshot.docs
                .map(d => ({ id: d.id, ...d.data() } as any))
                .filter(e => e.createdAt)
                .sort((a: any, b: any) => {
                    const ta = a.createdAt?.toDate?.() || new Date(0);
                    const tb = b.createdAt?.toDate?.() || new Date(0);
                    return tb.getTime() - ta.getTime();
                })
                .slice(0, 3);

            recentEvals.forEach((e: any) => {
                const statusLabel = e.semaphore === 'pending' ? 'Pendiente de revisión'
                    : e.semaphore === 'green' ? 'Aprobada'
                        : e.semaphore === 'red' ? 'No apta'
                            : 'En revisión';
                activities.push({
                    id: e.id,
                    type: 'evaluation',
                    studentName: userMap.get(e.userId) || 'Estudiante',
                    detail: `Evaluación actitudinal — ${statusLabel}`,
                    timestamp: e.createdAt?.toDate?.() || new Date(),
                });
            });

            // Sort by timestamp
            activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            setRecentActivity(activities.slice(0, 5));

        } catch (error) {
            console.error('Error loading dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12 h-64">
                <div className="w-8 h-8 border-2 border-[var(--primary-100)] border-t-[var(--primary-700)] rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-10">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-display text-[var(--text-primary)] tracking-tight">Dashboard</h1>
                    <p className="text-[var(--text-secondary)] mt-2 text-base font-medium">Bienvenido al centro de control.</p>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-[var(--success)]"></span>
                    <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Sistema Operativo</span>
                </div>
            </header>

            {/* Stats Grid - Real KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    icon={<Users size={24} />}
                    value={stats.activeStudents}
                    label="Estudiantes Activos"
                    color="text-[var(--primary-600)] bg-[var(--primary-50)]"
                />
                <StatCard
                    icon={<Award size={24} />}
                    value={`${stats.certificationRate}%`}
                    label="Tasa de Certificación"
                    color="text-emerald-600 bg-emerald-50"
                />
                <StatCard
                    icon={<ClipboardList size={24} />}
                    value={stats.pendingEvaluations}
                    label="Evaluaciones Pendientes"
                    color={stats.pendingEvaluations > 0
                        ? "text-amber-600 bg-amber-50"
                        : "text-slate-500 bg-slate-50"
                    }
                    alert={stats.pendingEvaluations > 0}
                />
                <StatCard
                    icon={<Target size={24} />}
                    value={`${stats.averageScore}%`}
                    label="Promedio General"
                    color="text-[var(--primary-500)] bg-[var(--primary-50)]"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Action Area */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-[var(--bg-surface)] rounded-2xl p-6 shadow-sm border border-[rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-h3 text-[var(--text-primary)]">Actividad Reciente</h3>
                        </div>
                        <div className="space-y-4">
                            {recentActivity.length === 0 ? (
                                <div className="text-center py-8">
                                    <div className="text-3xl mb-2">📭</div>
                                    <p className="text-sm text-[var(--text-muted)]">Sin actividad reciente aún</p>
                                </div>
                            ) : (
                                recentActivity.map((activity) => (
                                    <div key={activity.id} className="flex items-center gap-4 py-2 border-b border-[rgba(0,0,0,0.03)] last:border-0">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${activity.type === 'quiz'
                                            ? activity.passed
                                                ? 'bg-emerald-50 text-emerald-600'
                                                : 'bg-red-50 text-red-500'
                                            : 'bg-amber-50 text-amber-600'
                                            }`}>
                                            {activity.type === 'quiz'
                                                ? activity.passed
                                                    ? <CheckCircle size={18} />
                                                    : <XCircle size={18} />
                                                : <Clock size={18} />
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                                                {activity.studentName}
                                            </p>
                                            <p className="text-xs text-[var(--text-muted)]">
                                                {activity.detail}
                                            </p>
                                        </div>
                                        <div className="text-xs text-[var(--text-muted)] whitespace-nowrap">
                                            {formatTimeAgo(activity.timestamp)}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar / Helper Area */}
                <div className="space-y-6">
                    <div className="bg-gradient-to-b from-[var(--bg-surface)] to-[var(--bg-elevated)] rounded-3xl p-8 border border-[rgba(255,255,255,0.6)] shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-[var(--primary-100)] text-[var(--primary-700)] flex items-center justify-center">
                                <BookOpen size={20} />
                            </div>
                            <h3 className="text-lg font-bold text-[var(--text-primary)]">Guía Rápida</h3>
                        </div>

                        <div className="space-y-6 relative">
                            {/* Connecting Line */}
                            <div className="absolute top-[20px] left-[19px] bottom-[20px] w-[2px] bg-[var(--primary-100)] -z-10" />

                            <GuideStep
                                step="1"
                                title="Define la Ruta"
                                desc="Comienza creando una nueva ruta de aprendizaje."
                            />
                            <GuideStep
                                step="2"
                                title="Agrega Cursos"
                                desc="Estructura el conocimiento en cursos modulares."
                            />
                            <GuideStep
                                step="3"
                                title="Sube Contenido"
                                desc="Añade videos y quizzes a cada módulo."
                            />
                        </div>

                        <div className="mt-8">
                            <Link href="/admin/paths" className="block w-full">
                                <Button className="w-full !bg-[var(--primary-600)] hover:!bg-[var(--primary-700)] text-white shadow-lg shadow-[rgba(124,58,237,0.25)] !py-6 !rounded-xl text-base">
                                    Crear Nueva Ruta
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
}

function StatCard({ icon, value, label, color, alert }: {
    icon: React.ReactNode;
    value: number | string;
    label: string;
    color: string;
    alert?: boolean;
}) {
    return (
        <Card className="card-premium flex flex-col justify-between h-full !p-6 hover:!shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)]">
            <div className="flex items-start justify-between mb-4">
                <div className={`p-3.5 rounded-2xl ${color}`}>
                    {icon}
                </div>
                {alert && (
                    <div className="flex items-center text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                        Acción requerida
                    </div>
                )}
            </div>
            <div>
                <span className="block text-4xl font-bold text-[var(--text-primary)] leading-none mb-2 tracking-tight">{value}</span>
                <span className="text-sm font-medium text-[var(--text-secondary)]">{label}</span>
            </div>
        </Card>
    );
}

function ActionCard({ href, icon, title, description, color }: { href: string; icon: React.ReactNode; title: string; description: string; color: string }) {
    return (
        <Link href={href} className="block group h-full">
            <div className={`
                h-full relative overflow-hidden rounded-3xl p-7 transition-all duration-300
                bg-gradient-to-br ${color} text-white
                shadow-lg group-hover:shadow-xl group-hover:scale-[1.02]
            `}>
                <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-1/4 -translate-y-1/4">
                    {icon}
                </div>

                <div className="relative z-10 flex flex-col h-full">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-5 text-white border border-white/10">
                        {icon}
                    </div>
                    <h4 className="text-xl font-bold mb-2 tracking-tight">{title}</h4>
                    <p className="text-white/80 text-sm leading-relaxed font-medium">{description}</p>

                    <div className="mt-auto pt-6 flex items-center text-sm font-bold">
                        <span>Acceder</span>
                        <ArrowRight size={16} className="ml-2 transition-transform group-hover:translate-x-1" />
                    </div>
                </div>
            </div>
        </Link>
    );
}

function GuideStep({ step, title, desc }: { step: string; title: string; desc: string }) {
    return (
        <div className="relative flex items-start gap-4 group">
            <div className="w-10 h-10 rounded-full bg-white border-4 border-[var(--bg-surface)] flex items-center justify-center text-sm font-bold text-[var(--primary-700)] shadow-sm z-10">
                {step}
            </div>
            <div className="pt-1">
                <h4 className="font-bold text-[var(--text-primary)] text-sm mb-1 group-hover:text-[var(--primary-600)] transition-colors">{title}</h4>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{desc}</p>
            </div>
        </div>
    );
}
