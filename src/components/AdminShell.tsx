'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import Image from 'next/image';
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

export default function AdminShell({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading, signOut } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/');
        } else if (!loading && user && user.role !== 'admin') {
            router.push('/modules');
        }
    }, [user, loading, router]);

    // Establecer estado inicial basado en resolución para evitar hydration mismatches
    useEffect(() => {
        if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
            setIsSidebarOpen(true);
        }
    }, []);

    // Cerrar sidebar en cambio de ruta sólo en móvil/tablet
    useEffect(() => {
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            setIsSidebarOpen(false);
        }
    }, [pathname]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-surface">
                <div className="w-8 h-8 border-2 border-surface-dim border-t-primary rounded-full animate-spin mb-4"></div>
                <p className="text-outline-variant text-sm font-medium animate-pulse">Cargando...</p>
            </div>
        );
    }

    if (!user || user.role !== 'admin') {
        return null;
    }

    return (
        <div className="flex min-h-[100dvh] bg-surface font-sans text-on-surface">
            {/* Global Top Header (Native iOS Style PWA) */}
            <header className="fixed top-0 left-0 right-0 min-h-[64px] pt-[env(safe-area-inset-top,0px)] glass-panel z-50 px-4 xl:px-6 flex items-center justify-between border-b border-outline-variant/15 transition-all duration-300">
                <div className="flex items-center gap-4 lg:gap-6">
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2 -ml-2 text-on-surface hover:text-primary hover:bg-surface-container-low rounded-lg transition-all active:scale-95"
                        title={isSidebarOpen ? "Cerrar menú" : "Abrir menú"}
                    >
                        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                    {/* Brand */}
                    <div className="flex items-center gap-2.5 select-none">
                        <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-tr from-primary to-primary-container text-white shadow-md">
                            <GraduationCap size={16} strokeWidth={2.5} />
                        </div>
                        <span className="font-extrabold text-primary text-lg tracking-tight uppercase hidden sm:block">
                            Mi Talento <span className="text-secondary font-medium">| Admin</span>
                        </span>
                    </div>
                </div>

                {/* Top Right User Info & Actions */}
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex flex-col items-end justify-center">
                        <p className="text-sm font-extrabold text-gray-900 leading-tight">{user.displayName}</p>
                        <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wider">{user.email}</p>
                    </div>
                    <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary-container flex flex-shrink-0 items-center justify-center text-white font-bold text-sm shadow-sm border border-white overflow-hidden">
                        {user.photoURL ? (
                            <Image src={user.photoURL} alt={user.displayName || ''} fill className="object-cover" sizes="36px" />
                        ) : (
                            user.displayName?.charAt(0).toUpperCase() || 'A'
                        )}
                    </div>
                    <button
                        onClick={signOut}
                        className="p-2 text-on-surface hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                        title="Cerrar sesión"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            {/* Mobile/Tablet Backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-[#111c2d]/20 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-200"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar Drawer */}
            <aside className={`
                fixed top-0 bottom-0 left-0 bg-surface-container-lowest border-r border-outline-variant/15 z-[45] w-[260px]
                transition-transform duration-300 cubic-bezier(0.4, 0, 0.2, 1) shadow-xl
                flex flex-col pt-[calc(env(safe-area-inset-top,0px)+4rem)] pb-[env(safe-area-inset-bottom,0px)] select-none
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="flex flex-col h-full py-6">
                    {/* Navigation */}
                    <div className="px-3 space-y-7 overflow-y-auto flex-1 custom-scrollbar">
                        <div className="space-y-1">
                            <p className="px-3 text-[10px] font-extrabold text-gray-500 uppercase tracking-widest mb-3">Principal</p>
                            <NavLink href="/admin" icon={<LayoutDashboard size={18} />} text="Dashboard" active={pathname === '/admin'} />
                            <NavLink href="/admin/paths" icon={<Map size={18} />} text="Rutas y Cursos" active={pathname.startsWith('/admin/paths')} />
                            <NavLink href="/admin/users" icon={<Users size={18} />} text="Usuarios" active={pathname.startsWith('/admin/users')} />
                            <NavLink href="/admin/sofia" icon={<Bot size={18} />} text="Bally IA Knowledge" active={pathname.startsWith('/admin/sofia')} />
                            <NavLink href="/admin/certifications" icon={<Award size={18} />} text="Certificaciones" active={pathname.startsWith('/admin/certifications')} />
                        </div>

                        <div className="space-y-1">
                            <p className="px-3 text-[10px] font-extrabold text-gray-500 uppercase tracking-widest mb-3">Analítica</p>
                            <NavLink href="/admin/reports" icon={<BarChart3 size={18} />} text="Reportes" active={pathname.startsWith('/admin/reports')} />
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className={`
                pt-14 sm:pt-[calc(env(safe-area-inset-top,0px)+4rem)] flex-1 min-w-0 h-[100dvh] overflow-hidden transition-all duration-300
                ${isSidebarOpen ? 'lg:pl-[260px]' : 'pl-0'}
            `}>
                <div className="px-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] lg:px-12 lg:pt-8 lg:pb-16 w-full max-w-[1400px] mx-auto animate-fade-in h-full overflow-auto custom-scrollbar">
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
                group flex items-center px-4 py-3 mx-2 rounded-xl transition-all duration-300 justify-between
                ${active
                    ? 'bg-surface-container-low text-primary font-extrabold shadow-[0_4px_10px_rgba(71,30,82,0.06)]'
                    : 'text-on-surface hover:text-primary hover:bg-surface-dim/40'
                }
            `}
        >
            <div className="flex items-center gap-3">
                <span className={`transition-transform duration-300 ${active ? 'scale-110 text-primary' : 'group-hover:scale-105 opacity-80'}`}>
                    {icon}
                </span>
                <span className="text-[14px] whitespace-nowrap overflow-hidden text-ellipsis leading-none">{text}</span>
            </div>
            {active && <div className="w-1.5 h-1.5 rounded-full bg-secondary flex-shrink-0" />}
        </Link>
    );
}
