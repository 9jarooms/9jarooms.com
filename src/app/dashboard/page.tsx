import OpsApp from '@/components/ops/OpsApp';

export const dynamic = 'force-dynamic';

// Caretaker home: the Today screen for their assigned properties.
export default async function DashboardHome({ searchParams }: {
    searchParams: Promise<{ tab?: string }>;
}) {
    const { tab } = await searchParams;
    const initialTab = tab === 'units' || tab === 'bookings' ? tab : 'today';
    return <OpsApp initialTab={initialTab} bottomBar />;
}
