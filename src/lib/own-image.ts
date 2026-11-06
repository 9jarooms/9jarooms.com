import { z } from 'zod';

// Listing photos live in our own storage. A link to anywhere else could track guests or show them
// something we never approved.
const OWN_HOST = (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').host; } catch { return ''; } })();

export const ownImage = z.string().url().max(600).refine(u => {
    try { return new URL(u).protocol === 'https:' && new URL(u).host === OWN_HOST; } catch { return false; }
}, 'Photos must be uploaded here, not linked from another site');
