'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import StudentNavBar from '@/components/StudentNavBar';
import LoadingScreen from '@/components/LoadingScreen';

export default function BallyLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/');
        }
    }, [user, loading, router]);

    if (loading || !user) {
        return <LoadingScreen message="Conectando con Bally IA..." />;
    }

    return (
        <>
            <StudentNavBar />
            <div className="pb-[80px] md:pb-0 md:pl-[104px] lg:pl-[120px]">
                {children}
            </div>
        </>
    );
}
