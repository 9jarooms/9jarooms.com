import { NextRequest, NextResponse } from 'next/server';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;

// Create a Paystack subaccount for a property owner
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { business_name, bank_code, account_number, percentage_charge } = body;

        if (!business_name || !bank_code || !account_number) {
            return NextResponse.json(
                { error: 'business_name, bank_code, and account_number are required' },
                { status: 400 }
            );
        }

        const response = await fetch('https://api.paystack.co/subaccount', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                business_name,
                bank_code,
                account_number,
                percentage_charge: percentage_charge || 10, // Default 10% platform fee
            }),
        });

        const data = await response.json();

        if (!data.status) {
            return NextResponse.json({ error: data.message }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            subaccount_code: data.data.subaccount_code,
            data: data.data,
        });
    } catch (error) {
        console.error('Paystack subaccount error:', error);
        return NextResponse.json({ error: 'Failed to create subaccount' }, { status: 500 });
    }
}

// List Nigerian banks (for bank code selection)
export async function GET() {
    try {
        const response = await fetch('https://api.paystack.co/bank?country=nigeria', {
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET}`,
            },
        });

        const data = await response.json();
        return NextResponse.json({ banks: data.data });
    } catch (error) {
        console.error('Bank list error:', error);
        return NextResponse.json({ error: 'Failed to fetch banks' }, { status: 500 });
    }
}
