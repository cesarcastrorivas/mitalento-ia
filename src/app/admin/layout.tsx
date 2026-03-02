import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/server-auth';
import AdminShell from '@/components/AdminShell';

/**
 * Admin layout — Server Component.
 * Verifies admin role via Firebase Admin SDK BEFORE rendering any child.
 * This is the authoritative gate; AdminShell adds a secondary client-side UX check.
 */
export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await getServerUser();

    if (!user || user.role !== 'admin') {
        redirect('/');
    }

    return <AdminShell>{children}</AdminShell>;
}

