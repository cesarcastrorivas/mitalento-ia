'use client';

import Link from 'next/link';
import AdminPageHeader from '@/components/AdminPageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
    Users,
    GraduationCap,
    ArrowRight,
    BookOpen,
    Award,
    ClipboardList,
    Target,
    CheckCircle,
    XCircle,
    Clock,
    LayoutDashboard,
} from 'lucide-react';

interface RecentActivity {
    id: string;
    type: 'quiz' | 'evaluation';
    studentName: string;
    detail: string;
    score?: number;
    passed?: boolean;
    timestamp: string; // ISO string from server
}

interface DashboardStats {
    activeStudents: number;
    certificationRate: number;
    pendingEvaluations: number;
    averageScore: number;
}

interface AdminDashboardClientProps {
    stats: DashboardStats;
    recentActivity: RecentActivity[];
}

export function AdminDashboardClient({ stats, recentActivity }: AdminDashboardClientProps) {
    return (
        <div className="space-y-12 lg:space-y-16">
            <AdminPageHeader
                title="Dashboard"
                subtitle="Centro de control"
                icon={<LayoutDashboard size={20} />}
                action={
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        <span className="text-[11px] font-extrabold text-emerald-700 tracking-widest uppercase">Operativo</span>
                    </div>
                }
            />

            {/* Stats Grid - PWA Compact Native KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8">
                <StatCard
                    icon={<Users size={26} strokeWidth={1.5} />}
                    value={stats.activeStudents}
                    label="Estudiantes Activos"
                    color="text-[#60356a] bg-[#60356a]/10"
                />
                <StatCard
                    icon={<Award size={26} strokeWidth={1.5} />}
                    value={`${stats.certificationRate}%`}
                    label="Tasa de Certificación"
                    color="text-emerald-700 bg-emerald-500/10"
                />
                <StatCard
                    icon={<ClipboardList size={26} strokeWidth={1.5} />}
                    value={stats.pendingEvaluations}
                    label="Evaluaciones Pendientes"
                    color={stats.pendingEvaluations > 0
                        ? "text-[#f5a944] bg-[#f5a944]/10"
                        : "text-slate-400 bg-slate-50"
                    }
                    alert={stats.pendingEvaluations > 0}
                />
                <StatCard
                    icon={<Target size={26} strokeWidth={1.5} />}
                    value={`${stats.averageScore}%`}
                    label="Promedio General"
                    color="text-[#60356a] bg-[#60356a]/10"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Main Action Area */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="card-premium bg-surface-container-lowest rounded-[2rem] p-8 sm:p-10">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-display-sm text-[#60356a] m-0">Actividad Reciente</h3>
                        </div>
                        <div className="space-y-4">
                            {recentActivity.length === 0 ? (
                                <div className="text-center py-12 bg-surface rounded-2xl border border-outline-variant/10">
                                    <div className="text-4xl mb-4 opacity-50">📭</div>
                                    <p className="text-label-md text-slate-500">Sin actividad reciente aún</p>
                                </div>
                            ) : (
                                recentActivity.map((activity) => (
                                    <div key={activity.id} className="flex items-center gap-5 p-4 rounded-2xl hover:bg-surface-container-low transition-colors duration-300">
                                        <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center flex-shrink-0 ${activity.type === 'quiz'
                                            ? activity.passed
                                                ? 'bg-emerald-500/10 text-emerald-600'
                                                : 'bg-red-500/10 text-red-500'
                                            : 'bg-secondary-container/50 text-secondary'
                                            }`}>
                                            {activity.type === 'quiz'
                                                ? activity.passed
                                                    ? <CheckCircle size={22} strokeWidth={1.5} />
                                                    : <XCircle size={22} strokeWidth={1.5} />
                                                : <Clock size={22} strokeWidth={1.5} />
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-body-lg font-extrabold text-[#60356a] truncate mb-0.5">
                                                {activity.studentName}
                                            </p>
                                            <p className="text-label-md text-slate-500 truncate">
                                                {activity.detail}
                                            </p>
                                        </div>
                                        <div className="text-sm font-extrabold text-gray-500 whitespace-nowrap hidden sm:block">
                                            {formatTimeAgo(activity.timestamp)}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar / Helper Area */}
                <div className="space-y-8">
                    <div className="card-premium bg-gradient-to-br from-surface-container-lowest to-surface-container-low rounded-[2rem] p-8 sm:p-10 border border-white">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-[#f5a944]/10 text-[#f5a944] flex items-center justify-center shadow-[0_4px_14px_rgba(17,28,45,0.04)]">
                                <BookOpen size={22} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-display-sm text-[#60356a] m-0">Guía Rápida</h3>
                        </div>

                        <div className="space-y-8 relative">
                            {/* Connecting Line */}
                            <div className="absolute top-[24px] left-[23px] bottom-[24px] w-[2px] bg-primary-container/50 -z-10" />

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

                        <div className="mt-10">
                            <Link href="/admin/paths" className="block w-full">
                                <Button className="w-full py-4 text-body-lg font-bold bg-[#60356a] hover:bg-[#834f8f] border-transparent text-white transition-colors duration-300">
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

function formatTimeAgo(isoString: string): string {
    const date = new Date(isoString);
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
        <Card className="card-premium bg-surface-container-lowest flex flex-col justify-between h-full p-5 sm:p-8">
            <div className="flex items-start justify-between mb-8">
                <div className={`p-4 rounded-[1.25rem] ${color} select-none`}>
                    <div className="scale-90 sm:scale-100 origin-top-left transition-transform duration-300">
                        {icon}
                    </div>
                </div>
                {alert && (
                    <div className="hidden sm:flex items-center text-[10px] tracking-widest uppercase font-extrabold text-[#f5a944] bg-[#f5a944]/10 px-3 py-1.5 rounded-full">
                        Acción requerida
                    </div>
                )}
            </div>
            <div>
                <span className="block text-4xl sm:text-5xl font-extrabold text-[#60356a] leading-none mb-3 tracking-tighter">{value}</span>
                <span className="text-sm font-extrabold text-slate-500 leading-tight block">{label}</span>
            </div>
        </Card>
    );
}

function GuideStep({ step, title, desc }: { step: string; title: string; desc: string }) {
    return (
        <div className="relative flex items-start gap-5 group">
            <div className="w-12 h-12 rounded-full bg-surface-container-lowest border-4 border-surface flex items-center justify-center text-sm font-extrabold text-[#60356a] shadow-sm z-10 transition-transform duration-300 group-hover:scale-110">
                {step}
            </div>
            <div className="pt-2">
                <h4 className="font-extrabold text-[#60356a] text-base mb-1.5 group-hover:text-[#834f8f] transition-colors">{title}</h4>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
            </div>
        </div>
    );
}
