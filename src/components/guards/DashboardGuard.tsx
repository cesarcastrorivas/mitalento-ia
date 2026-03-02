'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import LoadingScreen from '@/components/LoadingScreen';

export default function DashboardGuard({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            // Si el cliente no tiene usuario, va al login
            if (!user) {
                router.push('/');
            }
            // Si el cliente piensa que es admin, va a admin
            else if (user.role === 'admin') {
                router.push('/admin');
            }
            // Si el cliente piensa que está logueado pero el servidor no renderizó children (cookie expiró)
            else if (!children) {
                router.push('/');
            }
        }
    }, [user, loading, children, router]);

    if (loading || !user) {
        return <LoadingScreen message="Preparando tu dashboard..." />;
    }

    if (!children) {
        // El servidor rechazó el renderizado, mostramos pantalla de carga hasta que el useEffect
        // (o el fallo del fetch en AuthContext) nos envíen de vuelta al login.
        return <LoadingScreen message="Sincronizando sesión..." />;
    }

    return <>{children}</>;
}
