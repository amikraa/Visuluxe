import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CacheEntry {
  cache_key: string;
  data: unknown;
  computed_at: string;
  expires_at: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('Starting analytics cache refresh...');
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    
    // Calculate date ranges
    const last7Days = {
      start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      end: now.toISOString(),
    };
    const last30Days = {
      start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end: now.toISOString(),
    };

    const cacheEntries: CacheEntry[] = [];

    // 1. Pre-compute model summary stats for 7 days
    console.log('Computing model summary stats (7d)...');
    const { data: modelStats7d, error: modelErr7d } = await supabase.rpc(
      'get_model_summary_stats',
      { p_start_date: last7Days.start, p_end_date: last7Days.end }
    );
    
    if (!modelErr7d && modelStats7d) {
      cacheEntries.push({
        cache_key: 'model_summary_7d',
        data: modelStats7d,
        computed_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });
    } else {
      console.error('Error computing model stats 7d:', modelErr7d);
    }

    // 2. Pre-compute model summary stats for 30 days
    console.log('Computing model summary stats (30d)...');
    const { data: modelStats30d, error: modelErr30d } = await supabase.rpc(
      'get_model_summary_stats',
      { p_start_date: last30Days.start, p_end_date: last30Days.end }
    );
    
    if (!modelErr30d && modelStats30d) {
      cacheEntries.push({
        cache_key: 'model_summary_30d',
        data: modelStats30d,
        computed_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });
    } else {
      console.error('Error computing model stats 30d:', modelErr30d);
    }

    // 3. Pre-compute provider summary stats for 7 days
    console.log('Computing provider summary stats (7d)...');
    const { data: providerStats7d, error: providerErr7d } = await supabase.rpc(
      'get_provider_summary_stats',
      { p_start_date: last7Days.start, p_end_date: last7Days.end }
    );
    
    if (!providerErr7d && providerStats7d) {
      cacheEntries.push({
        cache_key: 'provider_summary_7d',
        data: providerStats7d,
        computed_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });
    } else {
      console.error('Error computing provider stats 7d:', providerErr7d);
    }

    // 4. Pre-compute provider summary stats for 30 days
    console.log('Computing provider summary stats (30d)...');
    const { data: providerStats30d, error: providerErr30d } = await supabase.rpc(
      'get_provider_summary_stats',
      { p_start_date: last30Days.start, p_end_date: last30Days.end }
    );
    
    if (!providerErr30d && providerStats30d) {
      cacheEntries.push({
        cache_key: 'provider_summary_30d',
        data: providerStats30d,
        computed_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });
    } else {
      console.error('Error computing provider stats 30d:', providerErr30d);
    }

    // 5. Compute aggregate stats
    console.log('Computing aggregate stats...');
    const { count: totalImages } = await supabase
      .from('images')
      .select('*', { count: 'exact', head: true });

    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const { data: totalCreditsData } = await supabase
      .from('credits_transactions')
      .select('amount')
      .eq('type', 'generation');

    const totalCreditsSpent = totalCreditsData?.reduce(
      (sum, t) => sum + Math.abs(t.amount),
      0
    ) || 0;

    cacheEntries.push({
      cache_key: 'aggregate_stats',
      data: {
        total_images: totalImages || 0,
        total_users: totalUsers || 0,
        total_credits_spent: totalCreditsSpent,
        computed_at: now.toISOString(),
      },
      computed_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    });

    // Upsert all cache entries
    console.log(`Upserting ${cacheEntries.length} cache entries...`);
    for (const entry of cacheEntries) {
      const { error: upsertError } = await supabase
        .from('analytics_cache')
        .upsert(entry, { onConflict: 'cache_key' });
      
      if (upsertError) {
        console.error(`Error upserting cache entry ${entry.cache_key}:`, upsertError);
      }
    }

    // Clean up expired cache entries
    console.log('Cleaning up expired cache entries...');
    const { error: deleteError } = await supabase
      .from('analytics_cache')
      .delete()
      .lt('expires_at', now.toISOString());

    if (deleteError) {
      console.error('Error cleaning up expired cache:', deleteError);
    }

    console.log('Analytics cache refresh completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Analytics cache refreshed',
        entries_updated: cacheEntries.length,
        computed_at: now.toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error refreshing analytics cache:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
