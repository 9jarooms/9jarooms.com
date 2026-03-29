'use client';

import { useState, useEffect } from 'react';
import { MessageCircle, Loader2, CheckCircle, ExternalLink, Unlink } from 'lucide-react';

export default function TelegramConnect() {
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);

    useEffect(() => {
        checkStatus();
        // Auto-register webhook with Telegram (fire and forget)
        fetch('/api/webhooks/telegram').catch(console.error);
    }, []);

    const checkStatus = async () => {
        try {
            const res = await fetch('/api/telegram/connect');
            const data = await res.json();
            setConnected(data.connected);
        } catch (err) {
            console.error('Failed to check Telegram status:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = async () => {
        setConnecting(true);
        try {
            const res = await fetch('/api/telegram/connect', { method: 'POST' });
            const data = await res.json();
            
            if (!res.ok) {
                console.error('Server returned error:', data.error);
                alert(`Error: ${data.error || 'Connection failed'}`);
                setConnecting(false);
                return;
            }

            if (data.url) {
                // Use location.href instead of window.open to avoid mobile Safari popup blockers
                window.location.href = data.url;
                
                // Poll for connection status
                const poll = setInterval(async () => {
                    const statusRes = await fetch('/api/telegram/connect');
                    const statusData = await statusRes.json();
                    if (statusData.connected) {
                        setConnected(true);
                        clearInterval(poll);
                        setConnecting(false);
                    }
                }, 3000);
                // Stop polling after 2 minutes
                setTimeout(() => {
                    clearInterval(poll);
                    setConnecting(false);
                }, 120000);
            }
        } catch (err) {
            console.error('Failed to connect Telegram:', err);
            setConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm('Disconnect Telegram? You will stop receiving notifications.')) return;
        setDisconnecting(true);
        try {
            await fetch('/api/telegram/connect', { method: 'DELETE' });
            setConnected(false);
        } catch (err) {
            console.error('Failed to disconnect:', err);
        } finally {
            setDisconnecting(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                        <MessageCircle size={20} className="text-blue-500" />
                    </div>
                    <span className="text-sm text-gray-500">Telegram</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <Loader2 size={14} className="animate-spin" />
                    Checking...
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${connected ? 'bg-green-50' : 'bg-blue-50'}`}>
                    <MessageCircle size={20} className={connected ? 'text-green-600' : 'text-blue-500'} />
                </div>
                <span className="text-sm text-gray-500">Telegram</span>
            </div>

            {connected ? (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle size={16} />
                        <span className="text-sm font-medium">Connected</span>
                    </div>
                    <p className="text-xs text-gray-400">You&apos;ll receive booking notifications and can manage properties via Telegram.</p>
                    <button
                        onClick={handleDisconnect}
                        disabled={disconnecting}
                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                        {disconnecting ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />}
                        Disconnect
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    <p className="text-xs text-gray-400">Connect to manage properties and receive booking alerts via Telegram.</p>
                    <button
                        onClick={handleConnect}
                        disabled={connecting}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[#0088cc] hover:bg-[#0077b5] text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
                    >
                        {connecting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Waiting for connection...
                            </>
                        ) : (
                            <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                                </svg>
                                Connect to Telegram
                                <ExternalLink size={14} />
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
