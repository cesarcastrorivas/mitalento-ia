'use client';

import { memo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { Home, LogOut, Sparkles, GraduationCap, Wrench } from 'lucide-react';

const navItems = [
    { href: '/dashboard', label: 'Inicio', icon: Home },
    { href: '/sofia', label: 'Bally IA', icon: Sparkles },
    { href: '/tools', label: 'UBK', icon: Wrench },
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
                <header className="fixed top-0 left-0 right-0 z-50 bg-[#60356a] text-white border-b border-outline-variant/15 px-4 h-16 flex items-center pt-[env(safe-area-inset-top)]">
                    <div className="w-full max-w-[1400px] mx-auto flex items-center justify-between">
                        <Link href="/dashboard" className="flex items-center gap-2.5 group">
                            <Image 
                                src="/logo-urbanity.png" 
                                alt="Urbanity Construyendo Futuro" 
                                width={160} 
                                height={40} 
                                className="object-contain h-10 w-auto group-hover:opacity-90 transition-opacity" 
                                priority
                            />
                        </Link>

                        <div className="flex items-center gap-4">
                            <div className="hidden md:flex flex-col items-end justify-center mr-2">
                                <p className="text-sm font-bold text-white leading-tight">{user?.displayName}</p>
                                <p className="text-[10px] text-white/70 font-semibold uppercase tracking-wider">{user?.email}</p>
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
                            <button onClick={signOut} className="p-2 text-white hover:text-error hover:bg-error/10 rounded-lg transition-colors" title="Cerrar sesión">
                                <LogOut size={20} />
                            </button>
                        </div>
                    </div>
                </header>
            )}

            {/* Bottom Navigation (Floating Pill Style) */}
            <nav className="fixed bottom-6 w-full z-50 md:hidden px-4 pb-[env(safe-area-inset-bottom)] pointer-events-none">
                <div className="bg-white/90 backdrop-blur-md rounded-[2rem] border border-outline-variant/20 shadow-[0_20px_40px_rgba(71,30,82,0.12)] flex justify-around items-center p-2 mx-auto max-w-[22rem] pointer-events-auto">
                    {navItems.map((item) => {
                        const isDashboardSubPath = item.href === '/dashboard' && (pathname.startsWith('/paths/') || pathname.startsWith('/courses/') || pathname.startsWith('/modules/'));
                        const isActive = pathname === item.href || isDashboardSubPath;
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-col items-center justify-center px-4 sm:px-5 py-2 rounded-[1.5rem] transition-all duration-300 ease-out ${
                                    isActive 
                                    ? 'bg-primary/10 text-primary scale-105 active:scale-95' 
                                    : 'text-gray-400 hover:bg-purple-50 hover:text-primary active:scale-95'
                                }`}
                            >
                                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                                <span className="font-sans text-[10px] font-bold uppercase tracking-wider mt-1">
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
            {/* Desktop Side Navigation - Visible only on md+ when Top Nav exists */}
             {showTopBar && (
                 <nav className="hidden md:flex fixed top-1/2 -translate-y-1/2 left-6 z-40 w-[76px] flex-col items-center gap-8 bg-[#f5a944] rounded-[40px] py-8 shadow-[0_8px_40px_rgba(245,169,68,0.35)] border border-[#f5a944]/20">
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
                                 className={`w-[56px] h-[56px] flex items-center justify-center rounded-full transition-all duration-300 relative group ${isActive ? 'bg-[#60356a] text-white shadow-md scale-105' : 'text-[#60356a] hover:bg-[#60356a]/10 hover:scale-105'}`}
                                 title={item.label}
                             >
                                 <Icon size={26} strokeWidth={isActive ? 2.5 : 2} />
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
