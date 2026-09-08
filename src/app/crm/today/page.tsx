import OpsApp from '@/components/ops/OpsApp';

export const dynamic = 'force-dynamic';

// Phone-friendly operations view for reps and admins — same screen the
// caretakers use, across every property.
export default function CrmTodayPage() {
    return (
        <div className="p-4 sm:p-6">
            <OpsApp />
        </div>
    );
}
