import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Server-side helper to record actions into the append-only audit_logs table.
 * Invokes the security definer database function 'log_action_safely' to write secure log entries.
 */
export async function logAction(
  userId: string | null,
  userName: string,
  action: string,
  entityType: string,
  entityId: string | null,
  description: string
) {
  try {
    const adminClient = createAdminClient();
    
    const { error } = await adminClient.rpc('log_action_safely', {
      p_user_id: userId,
      p_user_name: userName,
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_description: description
    });

    if (error) {
      console.error('[logAction] database RPC log error:', error.message);
    }
  } catch (err) {
    console.error('[logAction] server-side logger threw error:', err);
  }
}
