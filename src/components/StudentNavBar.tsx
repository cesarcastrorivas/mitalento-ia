'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import styles from './StudentNavBar.module.css';
import { Home, User, LogOut, Sparkles, Trophy, Target, GraduationCap } from 'lucide-react';

const navItems = [
    { href: '/dashboard', label: 'Inicio', icon: Home },
    { href: '/certificacion', label: 'Certif.', icon: GraduationCap },
    { href: '/sofia', label: 'Bally IA', icon: Sparkles },
    { href: '/leaderboard', label: 'Ranking', icon: Trophy },
    { href: '/action-plan', label: 'Plan', icon: Target },
];

export default function StudentNavBar() {
    const pathname = usePathname();
    const { user, signOut } = useAuth();

    // Don't show on module player pages or admin
    if (pathname.startsWith('/modules/') || pathname.startsWith('/admin') || pathname.startsWith('/verify/') || pathname.startsWith('/evaluacion-actitudinal') || pathname.startsWith('/compromiso') || pathname === '/') {
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
                <header className={styles.topBar}>
                    <div className={styles.topBarInner}>
                        <Link href="/dashboard" className={styles.brand}>
                            <span className={styles.brandIcon}>🎓</span>
                            <span className={styles.brandText}>Mi Talento</span>
                        </Link>

                        <div className={styles.topRight}>
                            <div className={styles.avatarWrapper}>
                                {user?.photoURL ? (
                                    <img
                                        src={user.photoURL}
                                        alt={user.displayName || 'Avatar'}
                                        className={styles.avatarImg}
                                    />
                                ) : (
                                    <span className={styles.avatarInitial}>{getInitial()}</span>
                                )}
                            </div>
                            <button onClick={signOut} className={styles.logoutBtn} title="Cerrar sesión">
                                <LogOut size={18} />
                            </button>
                        </div>
                    </div>
                </header>
            )}

            {/* Bottom Navigation */}
            <nav className={styles.bottomNav}>
                <div className={styles.bottomNavInner}>
                    {navItems.map((item) => {
                        const isActive = pathname === item.href ||
                            (item.href === '/dashboard' && pathname.startsWith('/paths/')) ||
                            (item.href === '/dashboard' && pathname.startsWith('/courses/'));
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                            >
                                <div className={styles.navIconWrapper}>
                                    <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                                    {isActive && <div className={styles.activeIndicator} />}
                                </div>
                                <span className={styles.navLabel}>{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </>
    );
}
