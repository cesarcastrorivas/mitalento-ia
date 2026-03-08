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
        <div className="space-y-6 lg:space-y-10">
            <AdminPageHeader
                title="Dashboard"
                subtitle="Centro de control"
                icon={<LayoutDashboard size={18} />}
                action={
                    <div className="hidden sm:flex items-center gap-1.5">
                        <span className="flex h-2 w-2 rounded-full bg-[var(--success)]" />
                        <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Operativo</span>
                    </div>
                }
            />

            {/* Stats Grid - PWA Compact Native KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
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
        <Card className="card-premium flex flex-col justify-between h-full !p-3 sm:!p-6 !shadow-sm hover:!shadow-md transition-shadow !border border-[rgba(0,0,0,0.03)]">
            <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl ${color} select-none`}>
                    <div className="scale-75 sm:scale-100 origin-center">
                        {icon}
                    </div>
                </div>
                {alert && (
                    <div className="hidden sm:flex items-center text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                        Acción requerida
                    </div>
                )}
            </div>
            <div>
                <span className="block text-2xl sm:text-4xl font-bold text-[var(--text-primary)] leading-none mb-1 sm:mb-2 tracking-tight">{value}</span>
                <span className="text-[10px] sm:text-sm font-medium text-[var(--text-secondary)] leading-tight block">{label}</span>
            </div>
        </Card>
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
