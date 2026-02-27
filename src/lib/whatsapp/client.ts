import { z } from 'zod';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';

export class WhatsAppClient {
    private token: string;
    private phoneId: string;

    constructor() {
        this.token = process.env.WHATSAPP_ACCESS_TOKEN!;
        this.phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!;

        if (!this.token || !this.phoneId) {
            console.error('WhatsApp credentials missing');
        }
    }

    async sendMessage(to: string, text: string) {
        try {
            const response = await fetch(`${WHATSAPP_API_URL}/${this.phoneId}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: to,
                    type: 'text',
                    text: { preview_url: true, body: text },
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('WhatsApp Send Error:', JSON.stringify(error, null, 2));
                throw new Error(error.error?.message || 'Failed to send WhatsApp message');
            }

            return await response.json();
        } catch (error) {
            console.error('WhatsApp Client Error:', error);
            throw error;
        }
    }

    async markAsRead(messageId: string) {
        try {
            await fetch(`${WHATSAPP_API_URL}/${this.phoneId}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    status: 'read',
                    message_id: messageId,
                }),
            });
        } catch (error) {
            console.error('Failed to mark message as read:', error);
        }
    }
}

export const whatsapp = new WhatsAppClient();
