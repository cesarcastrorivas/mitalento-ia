'use client';

import { memo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { Home, LogOut, Sparkles, Trophy, GraduationCap } from 'lucide-react';

const navItems = [
    { href: '/dashboard', label: 'Inicio', icon: Home },
    { href: '/sofia', label: 'Bally IA', icon: Sparkles },
    { href: '/leaderboard', label: 'Ranking', icon: Trophy },
];

function StudentNavBar() {
    const pathname = usePathname();
    const { user, signOut } = useAuth();

    // Don't show on module player pages or admin
    if (pathname.startsWith('/modules/') || pathname.startsWith('/admin') || pathname.startsWith('/verify/') || pathname.startsWith('/compromiso') || pathname === '/') {
        return null;
    }

    const showTopBar = pathname !== '/sofia';

    const getInitial = () => {
        return user?.displayName?.charAt(0).toUpperCase() || 'U';
    };

    return (
        <>
            {/* Top Header Bar */}
            {showTopBar && (
                <header className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-outline-variant/15 px-4 h-16 flex items-center pt-[env(safe-area-inset-top)]">
                    <div className="w-full max-w-5xl mx-auto flex items-center justify-between">
                        <Link href="/dashboard" className="flex items-center gap-2.5 group">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary to-primary-container text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                                <GraduationCap size={18} strokeWidth={2.5} />
                            </div>
                            <span className="font-extrabold text-primary text-lg tracking-tight uppercase hidden sm:block">
                                Mi Talento
                            </span>
                        </Link>

                        <div className="flex items-center gap-4">
                            <div className="hidden md:flex flex-col items-end justify-center mr-2">
                                <p className="text-sm font-bold text-on-surface leading-tight">{user?.displayName}</p>
                                <p className="text-[10px] text-outline-variant font-medium uppercase tracking-wider">{user?.email}</p>
                            </div>
                            <div className="relative w-9 h-9 rounded-full bg-primary text-white border-2 border-surface flex items-center justify-center font-bold text-sm overflow-hidden shadow-sm">
                                {user?.photoURL ? (
                                    <Image
                                        src={user.photoURL}
                                        alt={user.displayName || 'Avatar'}
                                        fill
                                        sizes="36px"
                                        className="object-cover"
                                    />
                                ) : (
                                    getInitial()
                                )}
                            </div>
                            <button onClick={signOut} className="p-2 text-on-surface hover:text-error hover:bg-error/10 rounded-lg transition-colors" title="Cerrar sesión">
                                <LogOut size={20} />
                            </button>
                        </div>
                    </div>
                </header>
            )}

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 glass-panel border-t border-outline-variant/15 pb-[env(safe-area-inset-bottom)] md:hidden">
                <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href ||
                            (item.href === '/dashboard' && pathname.startsWith('/paths/')) ||
                            (item.href === '/dashboard' && pathname.startsWith('/courses/')) ||
                            (item.href === '/dashboard' && pathname.startsWith('/modules/'));
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors relative ${isActive ? 'text-primary' : 'text-secondary hover:text-on-surface'}`}
                            >
                                <div className="relative flex items-center justify-center">
                                    <Icon size={24} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'animate-fade-in-up' : ''} />
                                    {isActive && (
                                        <div className="absolute -inset-2 bg-primary/5 rounded-full -z-10" />
                                    )}
                                </div>
                                <span className="text-[10px] font-bold tracking-wide uppercase mt-1">
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
            {/* Desktop Side Navigation - Visible only on md+ when Top Nav exists */}
             {showTopBar && (
                 <nav className="hidden md:flex fixed top-1/2 -translate-y-1/2 left-6 z-40 flex-col gap-6 glass-panel rounded-full py-6 px-3 border border-outline-variant/15 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                    {navItems.map((item) => {
                         const isActive = pathname === item.href ||
                             (item.href === '/dashboard' && pathname.startsWith('/paths/')) ||
                             (item.href === '/dashboard' && pathname.startsWith('/courses/')) ||
                             (item.href === '/dashboard' && pathname.startsWith('/modules/'));
                         const Icon = item.icon;

                         return (
                             <Link
                                 key={item.href}
                                 href={item.href}
                                 className={`p-3 rounded-full flex items-center justify-center transition-all duration-300 relative group ${isActive ? 'bg-primary-container/30 text-primary' : 'text-secondary hover:text-on-surface hover:bg-surface-dim'}`}
                                 title={item.label}
                             >
                                 <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                                 <span className="absolute left-full ml-4 px-3 py-1.5 bg-surface-container-lowest text-on-surface text-xs font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all shadow-sm border border-outline-variant/15 whitespace-nowrap z-50">
                                     {item.label}
                                 </span>
                             </Link>
                         );
                     })}
                 </nav>
             )}
        </>
    );
}

export default memo(StudentNavBar);
