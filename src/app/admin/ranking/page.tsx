'use client';

import { Trophy } from 'lucide-react';
import AdminPageHeader from '@/components/AdminPageHeader';
import LeaderboardView from '@/components/LeaderboardView';
import styles from '@/app/leaderboard/page.module.css';

export default function AdminRankingPage() {
    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <AdminPageHeader
                title="Ranking"
                subtitle="Analítica"
                icon={<Trophy size={22} />}
            />
            <div className={styles.page} style={{ borderRadius: '1.5rem', minHeight: 'auto', padding: '2rem 1rem' }}>
                <div className={styles.container}>
                    <LeaderboardView />
                </div>
            </div>
        </div>
    );
}
