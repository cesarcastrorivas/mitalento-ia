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
    // Also check if we are in a module detail view (e.g., /modules/123) but NOT the index page /modules
    // Assuming /modules/[id] should be fullscreen
    const isModuleDetail = pathname !== '/modules' && pathname?.startsWith('/modules/');

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
            <div className="min-h-screen bg-surface font-sans text-on-surface">
                {/* Opcional: Podríamos ocultar la NavBar en preview si quisiéramos, pero mejor dejarla para consistencia */}
                <StudentNavBar />
                <main className="pb-24 pt-20 md:pl-24">
                    {children}
                </main>
            </div>
        );
    }

    if (loading) {
        // Mantener un estado de carga minimalista o renderizar children si queremos que la pagina maneje su loading
        return <LoadingScreen message="Verificando sesión..." />;
    }

    if (!user) {
        return null; // El useEffect redirigirá
    }

    // Hide NavBar for module detail pages to allow fullscreen player
    if (isModuleDetail) {
        return (
            <main className="h-screen w-full overflow-hidden bg-surface text-on-surface">
                {children}
            </main>
        );
    }

    return (
        <div className="min-h-screen bg-surface font-sans text-on-surface">
            <StudentNavBar />
            <main className="pb-24 pt-20 md:pl-24">
                {children}
            </main>
        </div>
    );
}
