import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export async function requireRoomAccess(roomId: string) {
    const sessionClient = await createServerClient();
    const { data: { user }, error: authError } = await sessionClient.auth.getUser();
    
    if (authError || !user) {
        return { error: 'Unauthorized', status: 401 };
    }

    const adminClient = createAdminClient();
    
    // Check admin
    const { data: roleData } = await adminClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();
        
    if (roleData) return { authorized: true, adminClient };
    
    // Get room property
    const { data: room } = await adminClient
        .from('rooms')
        .select('property_id')
        .eq('id', roomId)
        .single();
    
    if (!room) return { error: 'Room not found', status: 404 };
    
    const { data: property } = await adminClient
        .from('properties')
        .select('owner_id, caretaker_id')
        .eq('id', room.property_id)
        .single();
        
    if (!property) return { error: 'Property not found', status: 404 };

    // Check caretaker
    if (property.caretaker_id === user.id) return { authorized: true, adminClient };

    // Check owner
    const { data: owner } = await adminClient
        .from('owners')
        .select('id')
        .eq('user_id', user.id)
        .single();
        
    if (owner && property.owner_id === owner.id) return { authorized: true, adminClient };

    return { error: 'Forbidden', status: 403 };
}
