const TELEGRAM_API = 'https://api.telegram.org/bot';

export class TelegramClient {
    private token: string;

    constructor() {
        this.token = process.env.TELEGRAM_BOT_TOKEN!;
        if (!this.token) throw new Error('TELEGRAM_BOT_TOKEN not set');
    }

    private async request(method: string, body?: Record<string, unknown>) {
        const res = await fetch(`${TELEGRAM_API}${this.token}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json();
        if (!data.ok) {
            console.error(`Telegram API error (${method}):`, data);
            throw new Error(`Telegram API error: ${data.description || 'Unknown'}`);
        }
        return data.result;
    }

    async sendMessage(chatId: string | number, text: string, parseMode: 'HTML' | 'Markdown' = 'HTML') {
        return this.request('sendMessage', {
            chat_id: chatId,
            text,
            parse_mode: parseMode,
        });
    }
}
