import StudentNavBar from '@/components/StudentNavBar';
import DashboardGuard from '@/components/guards/DashboardGuard';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <DashboardGuard>
            <StudentNavBar />
            <div style={{ paddingBottom: '80px' }}>
                {children}
            </div>
        </DashboardGuard>
    );
}
