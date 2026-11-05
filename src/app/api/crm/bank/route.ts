import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrm } from '@/lib/auth/require-crm';

// The account guests pay into by bank transfer, quoted in the "room locked for 15 minutes" message.
// Everyone in the console can read it; only an admin can change it.
export async function GET() {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { data } = await auth.adminClient!.from('site_settings').select('value').eq('key', 'bank_transfer').maybeSingle();
    return NextResponse.json({ bank: data?.value || null, canEdit: auth.role === 'admin' });
}

const schema = z.object({
    bankName: z.string().trim().min(2).max(60),
    accountNumber: z.string().trim().regex(/^\d{10}$/, 'Account number must be 10 digits'),
    accountName: z.string().trim().min(2).max(100),
});
export async function PUT(request: NextRequest) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    if (auth.role !== 'admin') return NextResponse.json({ error: 'Only an admin can change the bank account' }, { status: 403 });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    const { error } = await auth.adminClient!.from('site_settings')
        .upsert({ key: 'bank_transfer', value: parsed.data, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
