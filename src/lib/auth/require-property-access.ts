import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export async function requirePropertyAccess(propertyId: string) {
    const sessionClient = await createServerClient();
    const { data: { user }, error: authError } = await sessionClient.auth.getUser();
    
    if (authError || !user) {
        return { error: 'Unauthorized: No active session', status: 401 };
    }

    const adminClient = createAdminClient();
    
    // Check if admin or operator (both have full property access)
    const { data: roleData } = await adminClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'call_operator'])
        .single();
        
    if (roleData) return { authorized: true, adminClient };

    // Fetch property to check ownership/caretaker
    const { data: property } = await adminClient
        .from('properties')
        .select('owner_id, caretaker_id')
        .eq('id', propertyId)
        .single();

    if (!property) return { error: 'Property not found', status: 404 };

    if (property.caretaker_id === user.id) {
        return { authorized: true, adminClient };
    }

    // Check if owner
    const { data: owner } = await adminClient
        .from('owners')
        .select('id')
        .eq('user_id', user.id)
        .single();
        
    if (owner && property.owner_id === owner.id) {
        return { authorized: true, adminClient };
    }

    return { error: 'Forbidden: You do not have access to this property', status: 403 };
}
