// Paystack API helpers for 9jaRooms

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

interface InitializePaymentParams {
    email: string;
    amount: number; // In kobo (NGN * 100)
    reference: string;
    subaccount: string; // Owner's Paystack sub-account code
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

// Initialize a payment transaction
export async function initializePayment(
    params: InitializePaymentParams
): Promise<PaystackInitResponse> {
    const body: Record<string, unknown> = {
        email: params.email,
        amount: params.amount,
        reference: params.reference,
        subaccount: params.subaccount,
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
