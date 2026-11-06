import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export async function requirePropertyAccess(propertyId: string) {
    const sessionClient = await createServerClient();
    const { data: { user }, error: authError } = await sessionClient.auth.getUser();
    
    if (authError || !user) {
        return { error: 'Unauthorized: No active session', status: 401 };
    }

    const adminClient = createAdminClient();
    
    // Admins have full property access
    const { data: roleData } = await adminClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
        
    if (roleData) return { authorized: true, adminClient, isAdmin: true, user };

    // Fetch property to check ownership/caretaker
    const { data: property } = await adminClient
        .from('properties')
        .select('caretaker_id')
        .eq('id', propertyId)
        .single();

    if (!property) return { error: 'Property not found', status: 404 };

    if (property.caretaker_id === user.id) {
        return { authorized: true, adminClient, user };
    }

    // owners only read: listings, prices and arrival instructions are changed by the team

    return { error: 'Forbidden: You do not have access to this property', status: 403 };
}
