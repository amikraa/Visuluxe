import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/contexts/AdminContext';
import { AlertTriangle, X, Clock, Calendar } from 'lucide-react';
import { CountdownTimer } from './MaintenanceCountdown';

const DISMISSED_KEY = 'maintenance_banner_dismissed';
const MESSAGE_HASH_KEY = 'maintenance_message_hash';

// Simple hash function for message comparison
function hashMessage(message: string): string {
  return btoa(encodeURIComponent(message)).slice(0, 16);
}

export function MaintenanceBanner() {
  const { isSuperAdmin, isOwner } = useAdmin();
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(DISMISSED_KEY) === 'true';
  });

  const { 
    isMaintenanceMode, 
    maintenanceMessage, 
    maintenancePages, 
    scheduledStart,
    scheduledEnd,
    isScheduledUpcoming
  } = useMaintenanceMode();

  // Check if message has changed since last dismiss - re-show banner if so
  useEffect(() => {
    if (maintenanceMessage && dismissed) {
      const currentHash = hashMessage(maintenanceMessage);
      const storedHash = localStorage.getItem(MESSAGE_HASH_KEY);
      
      // Re-show banner if message changed
      if (storedHash !== currentHash) {
        setDismissed(false);
        localStorage.removeItem(DISMISSED_KEY);
      }
    }
  }, [maintenanceMessage, dismissed]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, 'true');
    localStorage.setItem(MESSAGE_HASH_KEY, hashMessage(maintenanceMessage));
  };

  const canDismiss = isSuperAdmin || isOwner;

  // Show upcoming maintenance warning banner
  if (isScheduledUpcoming && scheduledStart && !dismissed) {
    return (
      <div className="fixed top-14 left-0 right-0 z-40 bg-yellow-500/90 backdrop-blur-sm border-b border-yellow-600">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-yellow-950">
            <Calendar className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-medium">
              <span className="font-bold">Scheduled Maintenance:</span>{' '}
              <CountdownTimer targetDate={scheduledStart} label="Starts in" />
              {maintenancePages.length > 0 && (
                <span className="ml-2 text-yellow-800">
                  (Affected: {maintenancePages.join(', ')})
                </span>
              )}
            </p>
          </div>
          {canDismiss && (
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-yellow-600/50 rounded transition-colors"
              title="Dismiss"
            >
              <X className="h-4 w-4 text-yellow-950" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Don't show if not in maintenance mode or dismissed by admin
  if (!isMaintenanceMode || (dismissed && canDismiss)) {
    return null;
  }

  return (
    <div className="fixed top-14 left-0 right-0 z-40 bg-amber-500/90 backdrop-blur-sm border-b border-amber-600">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-amber-950">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">
            <span className="font-bold">Maintenance Mode:</span> {maintenanceMessage}
            {scheduledEnd && (
              <span className="ml-2">
                — <CountdownTimer targetDate={scheduledEnd} label="Ends in" />
              </span>
            )}
            {maintenancePages.length > 0 && (
              <span className="ml-2 text-amber-800">
                (Affected: {maintenancePages.join(', ')})
              </span>
            )}
            {canDismiss && (
              <span className="ml-2 text-amber-800">(Admin bypass active)</span>
            )}
          </p>
        </div>
        {canDismiss && (
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-amber-600/50 rounded transition-colors"
            title="Dismiss"
          >
            <X className="h-4 w-4 text-amber-950" />
          </button>
        )}
      </div>
    </div>
  );
}

export function useMaintenanceMode() {
  const { data: maintenanceData, isLoading } = useQuery({
    queryKey: ['maintenance-mode'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', [
          'maintenance_mode', 
          'maintenance_message', 
          'maintenance_pages',
          'scheduled_maintenance_start',
          'scheduled_maintenance_end'
        ]);
      
      if (error) throw error;
      
      const settings: Record<string, unknown> = {};
      data?.forEach(s => {
        try {
          settings[s.key] = typeof s.value === 'string' ? JSON.parse(s.value as string) : s.value;
        } catch {
          settings[s.key] = s.value;
        }
      });
      
      return settings;
    },
    staleTime: 10000,
    refetchInterval: 30000, // Check every 30 seconds
  });

  const manualMaintenanceMode = maintenanceData?.maintenance_mode === true || maintenanceData?.maintenance_mode === 'true';
  const maintenanceMessage = (maintenanceData?.maintenance_message as string) || 'System is under maintenance.';
  const maintenancePages: string[] = Array.isArray(maintenanceData?.maintenance_pages) 
    ? maintenanceData.maintenance_pages 
    : ['/generate', '/dashboard'];

  // Parse scheduled times
  const scheduledStartRaw = maintenanceData?.scheduled_maintenance_start;
  const scheduledEndRaw = maintenanceData?.scheduled_maintenance_end;
  
  const scheduledStart = scheduledStartRaw && scheduledStartRaw !== 'null' && scheduledStartRaw !== null
    ? new Date(scheduledStartRaw as string)
    : null;
  const scheduledEnd = scheduledEndRaw && scheduledEndRaw !== 'null' && scheduledEndRaw !== null
    ? new Date(scheduledEndRaw as string)
    : null;

  // Auto-calculate scheduled maintenance state
  const now = new Date();
  const isInScheduledWindow = scheduledStart && scheduledEnd 
    ? (now >= scheduledStart && now <= scheduledEnd) 
    : false;
  const isScheduledUpcoming = scheduledStart 
    ? (now < scheduledStart) 
    : false;

  // Maintenance is active if manually enabled OR in scheduled window
  const isMaintenanceMode = manualMaintenanceMode || isInScheduledWindow;

  return { 
    isMaintenanceMode, 
    maintenanceMessage, 
    maintenancePages, 
    scheduledStart,
    scheduledEnd,
    isScheduledUpcoming,
    isLoading 
  };
}
