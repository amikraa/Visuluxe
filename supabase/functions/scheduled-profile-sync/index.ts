import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('Starting scheduled profile sync...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check for orphaned users using the RPC
    const { data: orphanedCount, error: countError } = await supabase.rpc('get_orphaned_user_count');
    
    if (countError) {
      console.error('Failed to get orphaned count:', countError);
      throw countError;
    }

    console.log(`Found ${orphanedCount} orphaned users`);

    if (orphanedCount && orphanedCount > 0) {
      // Sync missing profiles using the system RPC
      const { data: syncedCount, error: syncError } = await supabase.rpc('sync_missing_profiles_system');
      
      if (syncError) {
        console.error('Failed to sync profiles:', syncError);
        throw syncError;
      }
      
      console.log(`Auto-synced ${syncedCount} orphaned profiles`);
      
      // Log to audit trail (system action - no actor_id)
      const { error: auditError } = await supabase.from('admin_audit_logs').insert({
        actor_id: null,
        action: 'profiles_auto_synced',
        target_type: 'profiles',
        details: {
          synced_count: syncedCount,
          trigger: 'scheduled_job',
          timestamp: new Date().toISOString()
        }
      });

      if (auditError) {
        console.warn('Failed to log audit entry:', auditError);
        // Don't throw - audit logging is non-critical
      }

      // Notify super admins if any were synced
      if (syncedCount > 0) {
        const { data: superAdmins, error: adminsError } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'super_admin');

        if (!adminsError && superAdmins && superAdmins.length > 0) {
          const notifications = superAdmins.map(admin => ({
            user_id: admin.user_id,
            title: 'Profile Auto-Sync Completed',
            message: `${syncedCount} orphaned profile(s) were automatically synchronized.`,
            type: 'info' as const,
            action_url: '/admin/users'
          }));

          const { error: notifyError } = await supabase.from('notifications').insert(notifications);
          
          if (notifyError) {
            console.warn('Failed to send notifications:', notifyError);
          } else {
            console.log(`Notified ${superAdmins.length} super admin(s)`);
          }
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          synced: syncedCount,
          message: `Synced ${syncedCount} orphaned profiles`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('No orphaned users found - system healthy');
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        synced: 0, 
        message: 'No orphaned users found - system healthy' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Profile sync error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
