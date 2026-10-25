// Paystack API helpers for 9jaRooms

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

interface InitializePaymentParams {
    email: string;
    amount: number; // In kobo (NGN * 100)
    reference: string;
    subaccount?: string | null; // Owner's Paystack sub-account code; omitted = main account
    metadata?: Record<string, unknown>;
    callbackUrl?: string;
}

interface PaystackInitResponse {
    status: boolean;
    message: string;
    data: {
        authorization_url: string;
        access_code: string;
        reference: string;
    };
}

interface PaystackVerifyResponse {
    status: boolean;
    message: string;
    data: {
        status: string;
        reference: string;
        amount: number;
        currency: string;
        metadata: Record<string, unknown>;
    };
}

// Simulated Paystack for local demos and testing: no network, the "payment
// page" is /booking/mock-pay and verification always succeeds. Never active
// in production, whatever the env var says.
export const PAYSTACK_MOCK = process.env.PAYSTACK_MOCK === '1' && process.env.NODE_ENV !== 'production';

// Initialize a payment transaction
export async function initializePayment(
    params: InitializePaymentParams
): Promise<PaystackInitResponse> {
    if (PAYSTACK_MOCK) {
        const base = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
        const q = new URLSearchParams({ ref: params.reference, amount: String(params.amount), email: params.email });
        return {
            status: true,
            message: 'mock',
            data: { authorization_url: `${base}/booking/mock-pay?${q}`, access_code: 'mock', reference: params.reference },
        };
    }
    const body: Record<string, unknown> = {
        email: params.email,
        amount: params.amount,
        reference: params.reference,
        // 9jaRooms manages every property itself: no owner split, all money settles to the main account.
        // (params.subaccount is accepted for old callers and ignored on purpose.)
        callback_url: params.callbackUrl || `${process.env.NEXT_PUBLIC_APP_URL}/booking/confirm`,
        metadata: {
            ...params.metadata,
            custom_fields: [],
        },
    };

    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('Paystack API Error:', response.status, error);
        throw new Error(`Paystack initialization failed: ${error}`);
    }

    return response.json();
}

// Verify a payment transaction
export async function verifyPayment(reference: string): Promise<PaystackVerifyResponse> {
    if (PAYSTACK_MOCK) {
        return { status: true, message: 'mock', data: { status: 'success', reference, amount: 0, currency: 'NGN', metadata: {} } };
    }
    const response = await fetch(
        `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
        {
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET}`,
            },
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Paystack verification failed: ${error}`);
    }

    return response.json();
}

// Validate Paystack webhook signature
export function validateWebhookSignature(
    body: string,
    signature: string
): boolean {
    const crypto = require('crypto');
    const hash = crypto
        .createHmac('sha512', PAYSTACK_SECRET)
        .update(body)
        .digest('hex');

    return hash === signature;
}

// Generate a unique payment reference
export function generateReference(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `9JR-${timestamp}-${random}`.toUpperCase();
}
