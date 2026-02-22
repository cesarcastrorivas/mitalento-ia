'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import {
    LayoutDashboard,
    Map,
    Users,
    BarChart3,
    LogOut,
    GraduationCap,
    Menu,
    X,
    Bot,
    Award,
    TrendingUp
} from 'lucide-react';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading, signOut } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/');
        } else if (!loading && user && user.role !== 'admin') {
            router.push('/modules');
        }
    }, [user, loading, router]);

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [pathname]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-main)]">
                <div className="w-8 h-8 border-2 border-[var(--primary-100)] border-t-[var(--primary-700)] rounded-full animate-spin mb-4"></div>
                <p className="text-[var(--text-secondary)] text-sm font-medium animate-pulse">Cargando...</p>
            </div>
        );
    }

    if (!user || user.role !== 'admin') {
        return null;
    }

    return (
        <div className="flex min-h-screen bg-[var(--bg-main)] font-sans text-[var(--text-primary)]">
            {/* Mobile Header - Glassmorphism */}
            <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[rgba(255,255,255,0.8)] backdrop-blur-md border-b border-[rgba(0,0,0,0.05)] z-50 px-4 flex items-center justify-between transition-all duration-300">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="p-2 -ml-2 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] rounded-lg active:scale-95 transition-all"
                    >
                        <Menu size={20} />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-gradient-to-tr from-[var(--primary-700)] to-[var(--primary-500)] text-white shadow-lg shadow-[rgba(139,92,246,0.2)]">
                            <GraduationCap size={16} strokeWidth={2.5} />
                        </div>
                        <span className="font-bold text-[var(--text-primary)] text-sm tracking-tight">Mi Talento Admin</span>
                    </div>
                </div>
            </header>

            {/* Mobile Backdrop */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-[rgba(15,23,42,0.2)] backdrop-blur-sm z-50 lg:hidden animate-in fade-in duration-200"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar - Apple Style */}
            <aside className={`
                w-[260px] flex flex-col fixed inset-y-0 left-0 bg-[var(--bg-surface)] border-r border-[rgba(0,0,0,0.04)] z-[60]
                transition-transform duration-300 cubic-bezier(0.4, 0, 0.2, 1)
                lg:translate-x-0 lg:static lg:h-screen lg:z-40
                ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:shadow-none'}
            `}>
                <div className="flex flex-col h-full">
                    {/* Brand Section */}
                    <div className="px-6 pt-8 pb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary-700)] to-[var(--primary-600)] text-white shadow-lg shadow-[rgba(90,34,181,0.2)]">
                                <GraduationCap size={20} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h1 className="text-sm font-bold text-[var(--text-primary)] leading-none tracking-tight">
                                    Mi Talento
                                </h1>
                                <span className="text-[10px] font-semibold text-[var(--primary-600)] uppercase tracking-wider mt-0.5 block">
                                    Urbanity Admin
                                </span>
                            </div>

                            {/* Close button for mobile */}
                            <button
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="lg:hidden ml-auto p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="px-3 space-y-7 overflow-y-auto flex-1 custom-scrollbar">
                        <div className="space-y-1">
                            <p className="px-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Principal</p>
                            <NavLink href="/admin" icon={<LayoutDashboard size={18} />} text="Dashboard" active={pathname === '/admin'} />
                            <NavLink href="/admin/paths" icon={<Map size={18} />} text="Rutas y Cursos" active={pathname.startsWith('/admin/paths')} />
                            <NavLink href="/admin/users" icon={<Users size={18} />} text="Usuarios" active={pathname.startsWith('/admin/users')} />
                            <NavLink href="/admin/sofia" icon={<Bot size={18} />} text="SofIA Knowledge" active={pathname.startsWith('/admin/sofia')} />
                            <NavLink href="/admin/certifications" icon={<Award size={18} />} text="Certificaciones" active={pathname.startsWith('/admin/certifications')} />
                        </div>

                        <div className="space-y-1">
                            <p className="px-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Analítica</p>
                            <NavLink href="/admin/reports" icon={<BarChart3 size={18} />} text="Reportes" active={pathname.startsWith('/admin/reports')} />
                            <NavLink href="/admin/reportes-certificacion" icon={<TrendingUp size={18} />} text="Reportes Cert." active={pathname.startsWith('/admin/reportes-certificacion')} />
                        </div>
                    </div>

                    {/* User Profile - Bottom */}
                    <div className="p-4 mt-auto border-t border-[rgba(0,0,0,0.04)] bg-[var(--bg-surface)]">
                        <div className="bg-[var(--bg-elevated)] rounded-xl p-3 border border-[rgba(0,0,0,0.02)] transition-all hover:border-[rgba(0,0,0,0.06)] hover:shadow-sm">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--primary-900)] to-[var(--primary-700)] flex items-center justify-center text-white font-medium text-xs shadow-md border border-white">
                                    {user.displayName?.charAt(0).toUpperCase() || 'A'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{user.displayName}</p>
                                    <p className="text-[10px] text-[var(--text-secondary)] truncate">{user.email}</p>
                                </div>
                            </div>
                            <button
                                onClick={signOut}
                                className="w-full text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--error)] hover:bg-[rgba(239,68,68,0.08)] p-2 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 group"
                            >
                                <LogOut size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                                <span>Cerrar sesión</span>
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 min-w-0 relative">
                <div className="p-4 lg:p-8 pt-20 lg:pt-8 max-w-7xl mx-auto animate-fade-in">
                    {children}
                </div>
            </main>
        </div>
    );
}

function NavLink({ href, icon, text, active }: { href: string; icon: React.ReactNode; text: string; active: boolean }) {
    return (
        <Link
            href={href}
            className={`
                group flex items-center justify-between px-3 py-2.5 mx-2 rounded-lg transition-all duration-200
                ${active
                    ? 'bg-[var(--primary-50)] text-[var(--primary-700)] font-medium'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                }
            `}
        >
            <div className="flex items-center gap-3">
                <span className={`transition-transform duration-200 ${active ? 'scale-110 text-[var(--primary-600)]' : 'group-hover:scale-105'}`}>
                    {icon}
                </span>
                <span className="text-[13px]">{text}</span>
            </div>
            {active && <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary-500)]" />}
        </Link>
    );
}
