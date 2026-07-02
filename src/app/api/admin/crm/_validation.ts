import { z } from 'zod';

const emptyToNull = (v: unknown) => (v === '' ? null : v);

export const bookingSchema = z.object({
    guest_name: z.string().trim().min(1, 'Guest name is required').max(200),
    guest_email: z.preprocess(emptyToNull, z.string().trim().email().nullable().optional()),
    guest_phone: z.preprocess(emptyToNull, z.string().trim().max(40).nullable().optional()),
    property_id: z.preprocess(emptyToNull, z.string().uuid().nullable().optional()),
    rooms_booked: z.coerce.number().int().min(1).max(100),
    check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid check-in date'),
    check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid check-out date'),
    amount_paid: z.coerce.number().min(0).max(1_000_000_000),
    source_id: z.preprocess(emptyToNull, z.string().uuid().nullable().optional()),
    status: z.enum(['confirmed', 'cancelled']).optional(),
    notes: z.preprocess(emptyToNull, z.string().max(2000).nullable().optional()),
}).refine((d) => d.check_out > d.check_in, {
    message: 'Check-out must be after check-in',
    path: ['check_out'],
});

export const sourceSchema = z.object({
    label: z.string().trim().min(1, 'Label is required').max(100),
    color: z.preprocess(emptyToNull, z.string().trim().max(20).nullable().optional()),
    is_active: z.boolean().optional(),
    sort_order: z.coerce.number().int().optional(),
});

export const propertySchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    total_rooms: z.coerce.number().int().min(0).max(10000),
    is_active: z.boolean().optional(),
    sort_order: z.coerce.number().int().optional(),
});
