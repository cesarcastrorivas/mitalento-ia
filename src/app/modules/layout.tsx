'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import StudentNavBar from '@/components/StudentNavBar';
import LoadingScreen from '@/components/LoadingScreen';

export default function StudentLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const isPreview = pathname?.includes('/modules/preview');

    useEffect(() => {
        if (loading) return;

        // Permitir acceso a preview sin auth
        if (isPreview) return;

        if (!user) {
            router.push('/');
        } else if (user.role === 'admin') {
            router.push('/admin');
        }
    }, [user, loading, router, isPreview]);

    // Si es preview, renderizar sin comprobaciones
    if (isPreview) {
        return (
            <>
                {/* Opcional: Podríamos ocultar la NavBar en preview si quisiéramos, pero mejor dejarla para consistencia */}
                <StudentNavBar />
                <main style={{ paddingBottom: '80px' }}>
                    {children}
                </main>
            </>
        );
    }

    if (loading) {
        // Mantener un estado de carga minimalista o renderizar children si queremos que la pagina maneje su loading
        return <LoadingScreen message="Verificando sesión..." />;
    }

    if (!user) {
        return null; // El useEffect redirigirá
    }

    return (
        <>
            <StudentNavBar />
            <main style={{ paddingBottom: '80px' }}>
                {children}
            </main>
        </>
    );
}
