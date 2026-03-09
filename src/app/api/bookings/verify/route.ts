import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyPayment } from '@/lib/paystack';
import { inngest } from '@/lib/inngest/client';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get('reference');

    if (!reference) {
        return NextResponse.json({ error: 'Missing payment reference' }, { status: 400 });
    }

    try {
        const supabase = createAdminClient();

        // 1. Find Booking
        const { data: booking, error: dbError } = await supabase
            .from('bookings')
            .select('*, property:properties(*), room:rooms(*)')
            .eq('paystack_reference', reference)
            .single();

        if (dbError || !booking) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        // Return immediately if it's already marked as paid (webhook beat us here)
        if (booking.status === 'paid') {
            return NextResponse.json({ status: 'success', booking });
        }

        // 2. Verify with Paystack (since it's not marked paid yet)
        const verification = await verifyPayment(reference);

        if (verification.status && verification.data.status === 'success') {
            // Update booking status
            await supabase
                .from('bookings')
                .update({ status: 'paid', expires_at: null })
                .eq('id', booking.id);

            await supabase
                .from('availability')
                .update({ status: 'booked' })
                .eq('booking_id', booking.id);

            // Trigger Post-Payment Workflow via Inngest
            try {
                await inngest.send({
                    name: 'payment/confirmed',
                    data: {
                        reference: reference,
                        amount: verification.data.amount,
                        paystackData: verification.data,
                    },
                });
            } catch (inngestErr: any) {
                console.error('[Verify API] Inngest event failed (non-blocking):', inngestErr?.message);
            }

            // Fetch the updated booking to return it
            const { data: updatedBooking } = await supabase
                .from('bookings')
                .select('*, property:properties(*), room:rooms(*)')
                .eq('paystack_reference', reference)
                .single();

            return NextResponse.json({ status: 'success', booking: updatedBooking });
        } else {
            return NextResponse.json({ 
                status: 'pending', 
                paystack_status: verification.data?.status 
            });
        }
    } catch (error: any) {
        console.error('API /bookings/verify Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
