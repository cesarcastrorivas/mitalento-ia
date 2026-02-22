'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Course, User } from '@/types';
import { FIXED_PATHS } from '@/lib/constants';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
    Map,
    BookOpen,
    Users,
    GraduationCap,
    Zap,
    ArrowRight,
    Layout,
    FileVideo,
    Plus,
    TrendingUp,
    MoreHorizontal
} from 'lucide-react';

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        totalModules: 0,
        activeModules: 0,
        totalUsers: 0,
        totalStudents: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            // Usar rutas fijas
            const paths = FIXED_PATHS;
            const existingPathIds = new Set(paths.map(p => p.id));

            // Cargar Cursos y filtrar solo los que pertenecen a las rutas fijas
            const coursesSnapshot = await getDocs(collection(db, 'courses'));
            const allCourses = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
            const validCourses = allCourses.filter(course => existingPathIds.has(course.pathId));

            // Cargar usuarios
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const users = usersSnapshot.docs.map(doc => doc.data() as User);

            setStats({
                totalModules: paths.length,
                activeModules: validCourses.length,
                totalUsers: users.length,
                totalStudents: users.filter(u => u.role === 'student').length,
            });

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

            {/* Stats Grid - Apple Widgets Style */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    icon={<Map size={24} />}
                    value={stats.totalModules}
                    label="Rutas Activas"
                    trend="+12%"
                    color="text-[var(--primary-600)] bg-[var(--primary-50)]"
                />
                <StatCard
                    icon={<BookOpen size={24} />}
                    value={stats.activeModules}
                    label="Cursos Totales"
                    trend="+5%"
                    color="text-amber-600 bg-amber-50"
                />
                <StatCard
                    icon={<Users size={24} />}
                    value={stats.totalUsers}
                    label="Usuarios"
                    trend="+24%"
                    color="text-[var(--primary-500)] bg-[var(--primary-50)]"
                />
                <StatCard
                    icon={<GraduationCap size={24} />}
                    value={stats.totalStudents}
                    label="Estudiantes"
                    trend="+18%"
                    color="text-emerald-600 bg-emerald-50"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Action Area */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-h2 text-[var(--text-primary)]">Acciones Rápidas</h2>
                        <Button variant="ghost" className="text-[var(--primary-600)] hover:text-[var(--primary-700)] text-sm font-medium">
                            Ver todo
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <ActionCard
                            href="/admin/paths"
                            icon={<Layout size={28} />}
                            title="Gestionar Contenido"
                            description='Crea nuevas Rutas, asigna Cursos y organiza el material educativo.'
                            color="from-[var(--primary-600)] to-[var(--primary-800)]"
                        />
                        <ActionCard
                            href="/admin/users"
                            icon={<Users size={28} />}
                            title="Directorio de Usuarios"
                            description="Administra estudiantes, profesores y permisos de acceso."
                            color="from-slate-700 to-slate-900"
                        />
                    </div>

                    {/* Recent Activity Placeholder - Could be a list */}
                    <div className="bg-[var(--bg-surface)] rounded-2xl p-6 shadow-sm border border-[rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-h3 text-[var(--text-primary)]">Actividad Reciente</h3>
                            <button className="p-2 hover:bg-[var(--bg-elevated)] rounded-full transition-colors text-[var(--text-muted)]">
                                <MoreHorizontal size={20} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            {[1, 2, 3].map((_, i) => (
                                <div key={i} className="flex items-center gap-4 py-2 border-b border-[rgba(0,0,0,0.03)] last:border-0">
                                    <div className="w-10 h-10 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-secondary)]">
                                        <Zap size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-[var(--text-primary)]">Nuevo estudiante registrado</p>
                                        <p className="text-xs text-[var(--text-muted)]">Hace {i * 2 + 5} minutos</p>
                                    </div>
                                </div>
                            ))}
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

function StatCard({ icon, value, label, trend, color }: { icon: React.ReactNode; value: number; label: string; trend: string; color: string }) {
    return (
        <Card className="card-premium flex flex-col justify-between h-full !p-6 hover:!shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)]">
            <div className="flex items-start justify-between mb-4">
                <div className={`p-3.5 rounded-2xl ${color}`}>
                    {icon}
                </div>
                <div className="flex items-center text-xs font-bold text-[var(--success)] bg-[rgba(34,197,94,0.1)] px-2 py-1 rounded-full">
                    <TrendingUp size={12} className="mr-1" />
                    {trend}
                </div>
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
                    {/* Large background icon */}
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
