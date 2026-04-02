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
            <div className="pb-[80px] md:pb-0 md:pl-[104px] lg:pl-[120px]">
                {children}
            </div>
        </DashboardGuard>
    );
}
