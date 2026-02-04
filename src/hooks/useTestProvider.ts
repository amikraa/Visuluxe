import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TestResult {
  success: boolean;
  message: string;
  responseTime: number;
  details: {
    statusCode: number;
    endpoint: string;
    method?: string;
    timestamp: string;
    errorDetails?: string;
  };
}

export function useTestProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (providerId: string): Promise<TestResult> => {
      const { data, error } = await supabase.functions.invoke('test-provider-connection', {
        body: { provider_id: providerId }
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to test provider connection');
      }
      
      return data as TestResult;
    },
    onSuccess: () => {
      // Invalidate providers query to refresh the list with updated test results
      queryClient.invalidateQueries({ queryKey: ['admin-providers'] });
    },
  });
}

export function useTestAllProviders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (providerIds: string[]): Promise<{ providerId: string; result: TestResult }[]> => {
      const results: { providerId: string; result: TestResult }[] = [];
      
      for (const providerId of providerIds) {
        try {
          const { data, error } = await supabase.functions.invoke('test-provider-connection', {
            body: { provider_id: providerId }
          });
          
          if (error) {
            results.push({
              providerId,
              result: {
                success: false,
                message: error.message || 'Failed to test connection',
                responseTime: 0,
                details: {
                  statusCode: 0,
                  endpoint: '',
                  timestamp: new Date().toISOString(),
                  errorDetails: error.message,
                },
              },
            });
          } else {
            results.push({ providerId, result: data as TestResult });
          }
        } catch (err) {
          results.push({
            providerId,
            result: {
              success: false,
              message: err instanceof Error ? err.message : 'Unknown error',
              responseTime: 0,
              details: {
                statusCode: 0,
                endpoint: '',
                timestamp: new Date().toISOString(),
                errorDetails: err instanceof Error ? err.message : 'Unknown error',
              },
            },
          });
        }
        
        // Add 1-second delay between tests to avoid rate limiting
        if (providerIds.indexOf(providerId) < providerIds.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-providers'] });
    },
  });
}
