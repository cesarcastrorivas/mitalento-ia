'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import styles from './page.module.css';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import LeaderboardView from '@/components/LeaderboardView';

export default function LeaderboardPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && (!user || user.role !== 'admin')) {
            router.replace('/dashboard');
        }
    }, [user, loading, router]);

    if (loading || !user || user.role !== 'admin') {
        return (
            <div className={styles.page}>
                <div className={styles.loading}>
                    <div className={styles.spinner} />
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.container}>
                <div className={styles.topNav}>
                    <Link href="/admin" className={styles.backBtn}>
                        <ArrowLeft size={20} />
                        <span>Volver</span>
                    </Link>
                </div>
                <LeaderboardView />
            </div>
        </div>
    );
}
