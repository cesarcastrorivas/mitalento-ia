'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import StudentNavBar from '@/components/StudentNavBar';

import LoadingScreen from '@/components/LoadingScreen';

export default function ProfileLayout({
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
        return <LoadingScreen message="Cargando perfil..." />;
    }

    return (
        <>
            <StudentNavBar />
            <div style={{ paddingBottom: '80px' }}>
                {children}
            </div>
        </>
    );
}
