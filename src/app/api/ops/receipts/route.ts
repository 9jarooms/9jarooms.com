import { NextRequest, NextResponse } from 'next/server';
import { requireOps } from '@/lib/auth/require-ops';

// Receipt photos for payments (optional). Upload: POST multipart { file, bookingId } -> { path }.
// View: GET ?path= -> a link that works for 10 minutes. The bucket itself is private.
export async function POST(request: NextRequest) {
    const auth = await requireOps();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const form = await request.formData();
    const file = form.get('file');
    const bookingId = String(form.get('bookingId') || '');
    if (!(file instanceof File) || !/^[0-9a-f-]{36}$/i.test(bookingId)) return NextResponse.json({ error: 'Pick a photo' }, { status: 400 });
    if (!/^image\//.test(file.type) && file.type !== 'application/pdf') return NextResponse.json({ error: 'A photo or PDF, please' }, { status: 400 });
    if (file.size > 6 * 1024 * 1024) return NextResponse.json({ error: 'That file is too big (6 MB max)' }, { status: 400 });
    const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';
    const path = `${bookingId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await auth.adminClient.storage.from('receipts').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
    if (error) return NextResponse.json({ error: 'Could not upload the receipt' }, { status: 500 });
    return NextResponse.json({ path });
}

export async function GET(request: NextRequest) {
    const auth = await requireOps();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const path = new URL(request.url).searchParams.get('path') || '';
    if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|pdf)$/i.test(path)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { data } = await auth.adminClient.storage.from('receipts').createSignedUrl(path, 600);
    if (!data?.signedUrl) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.redirect(data.signedUrl);
}
