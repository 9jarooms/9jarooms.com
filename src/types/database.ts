// ============================================
// 9jaRooms Database Types
// ============================================

export type Database = {
    public: {
        Tables: {
            user_roles: {
                Row: UserRoleRecord;
                Insert: Omit<UserRoleRecord, 'id'> & { id?: string };
                Update: Partial<Omit<UserRoleRecord, 'id'>>;
                Relationships: [];
            };
            owners: {
                Row: Owner;
                Insert: Omit<Owner, 'id' | 'created_at' | 'updated_at'> & { id?: string; user_id?: string | null };
                Update: Partial<Omit<Owner, 'id'>>;
                Relationships: [];
            };
            caretakers: {
                Row: Caretaker;
                Insert: Omit<Caretaker, 'created_at' | 'updated_at'>;
                Update: Partial<Omit<Caretaker, 'id'>>;
                Relationships: [];
            };
            properties: {
                Row: Property;
                Insert: Omit<Property, 'id' | 'created_at' | 'updated_at'> & { id?: string };
                Update: Partial<Omit<Property, 'id'>>;
                Relationships: [
                    {
                        foreignKeyName: 'properties_owner_id_fkey';
                        columns: ['owner_id'];
                        isOneToOne: false;
                        referencedRelation: 'owners';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'properties_caretaker_id_fkey';
                        columns: ['caretaker_id'];
                        isOneToOne: false;
                        referencedRelation: 'caretakers';
                        referencedColumns: ['id'];
                    },
                ];
            };
            rooms: {
                Row: Room;
                Insert: Omit<Room, 'id' | 'created_at' | 'updated_at'> & { id?: string };
                Update: Partial<Omit<Room, 'id'>>;
                Relationships: [
                    {
                        foreignKeyName: 'rooms_property_id_fkey';
                        columns: ['property_id'];
                        isOneToOne: false;
                        referencedRelation: 'properties';
                        referencedColumns: ['id'];
                    },
                ];
            };
            bookings: {
                Row: Booking;
                Insert: Omit<Booking, 'id' | 'created_at' | 'updated_at'> & { id?: string };
                Update: Partial<Omit<Booking, 'id'>>;
                Relationships: [
                    {
                        foreignKeyName: 'bookings_room_id_fkey';
                        columns: ['room_id'];
                        isOneToOne: false;
                        referencedRelation: 'rooms';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'bookings_property_id_fkey';
                        columns: ['property_id'];
                        isOneToOne: false;
                        referencedRelation: 'properties';
                        referencedColumns: ['id'];
                    },
                ];
            };
            availability: {
                Row: Availability;
                Insert: Omit<Availability, 'id'> & { id?: string; booking_id?: string | null };
                Update: Partial<Omit<Availability, 'id'>>;
                Relationships: [
                    {
                        foreignKeyName: 'availability_room_id_fkey';
                        columns: ['room_id'];
                        isOneToOne: false;
                        referencedRelation: 'rooms';
                        referencedColumns: ['id'];
                    },
                ];
            };
            transactions: {
                Row: Transaction;
                Insert: Omit<Transaction, 'id' | 'created_at'> & { id?: string };
                Update: Partial<Omit<Transaction, 'id'>>;
                Relationships: [
                    {
                        foreignKeyName: 'transactions_booking_id_fkey';
                        columns: ['booking_id'];
                        isOneToOne: false;
                        referencedRelation: 'bookings';
                        referencedColumns: ['id'];
                    },
                ];
            };
            conversations: {
                Row: Conversation;
                Insert: Omit<Conversation, 'id' | 'created_at' | 'updated_at'> & { id?: string };
                Update: Partial<Omit<Conversation, 'id'>>;
                Relationships: [];
            };
        };
        Views: Record<string, never>;
        Functions: Record<string, never>;
        Enums: Record<string, never>;
        CompositeTypes: Record<string, never>;
    };
};

// ============================================
// Table Types
// ============================================

export type UserRole = 'admin' | 'owner' | 'caretaker' | 'call_operator';

export interface UserRoleRecord {
    id: string;
    user_id: string;
    role: UserRole;
}

export interface Owner {
    id: string;
    user_id: string | null;
    name: string;
    email: string;
    phone: string | null;
    paystack_subaccount_code: string | null;
    created_at: string;
    updated_at: string;
}

export interface Caretaker {
    id: string; // matches auth.users.id
    name: string;
    email: string;
    phone: string | null;
    created_at: string;
    updated_at: string;
}

export interface Property {
    id: string;
    owner_id: string;
    caretaker_id: string | null;
    name: string;
    description: string | null;
    address: string | null;
    city: string;
    state: string;
    area: string | null;
    price_per_night: number;
    type: string | null;
    amenities: string[];
    images: string[];
    thumbnail: string | null;
    max_guests: number;
    check_in_time: string;
    check_out_time: string;
    check_in_instructions: string | null;
    house_rules: string | null;
    is_active: boolean;
    is_featured: boolean;
    created_at: string;
    updated_at: string;
}

export interface Room {
    id: string;
    property_id: string;
    name: string;
    description: string | null;
    price_per_night: number | null;
    max_guests: number;
    images: string[];
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export type BookingStatus = 'pending' | 'paid' | 'cancelled' | 'completed' | 'expired' | 'confirmed';

export interface Booking {
    id: string;
    room_id: string;
    property_id: string;
    guest_name: string;
    guest_email: string;
    guest_phone: string | null;
    user_id: string | null;
    check_in: string;
    check_out: string;
    nights: number;
    price_per_night: number;
    total_amount: number;
    status: BookingStatus;
    paystack_reference: string | null;
    paystack_access_code: string | null;
    paystack_authorization_url: string | null;
    expires_at: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export type AvailabilityStatus = 'available' | 'held' | 'booked' | 'cleaning' | 'maintenance';

export interface Availability {
    id: string;
    room_id: string;
    date: string;
    status: AvailabilityStatus;
    booking_id: string | null;
}

export interface Transaction {
    id: string;
    paystack_reference: string;
    paystack_event: string;
    amount: number;
    currency: string;
    status: string;
    booking_id: string | null;
    raw_payload: Record<string, unknown> | null;
    created_at: string;
}

export interface Conversation {
    id: string;
    channel: string;
    external_id: string | null;
    guest_name: string | null;
    guest_phone: string | null;
    guest_email: string | null;
    messages: ConversationMessage[];
    context: Record<string, unknown>;
    last_message_at: string;
    created_at: string;
    updated_at: string;
}

export interface ConversationMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
}

// ============================================
// Joined/Extended Types (for queries with relations)
// ============================================

export interface PropertyWithRooms extends Property {
    rooms: Room[];
    owner: Owner;
}

export interface BookingWithDetails extends Booking {
    room: Room;
    property: Property;
}

export interface RoomWithAvailability extends Room {
    availability: Availability[];
}
