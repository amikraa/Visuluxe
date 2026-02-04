import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, Globe, Copy, RefreshCw, Edit2, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { TestResult } from '@/hooks/useTestProvider';

interface ProviderTestResultsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerName: string;
  providerId: string;
  testResult: TestResult | null;
  onTestAgain: () => void;
  onEdit: () => void;
  isRetesting?: boolean;
}

export default function ProviderTestResultsModal({
  open,
  onOpenChange,
  providerName,
  testResult,
  onTestAgain,
  onEdit,
  isRetesting = false,
}: ProviderTestResultsModalProps) {
  if (!testResult) return null;

  const handleCopyError = () => {
    const errorData = JSON.stringify(testResult.details, null, 2);
    navigator.clipboard.writeText(errorData);
    toast.success('Error details copied to clipboard');
  };

  const getErrorSuggestion = (statusCode: number, message: string): string | null => {
    if (statusCode === 401 || statusCode === 403 || message.includes('unauthorized') || message.includes('Invalid API key')) {
      return 'Check if your API key is correct and has the required permissions. Make sure the key is not expired or revoked.';
    }
    if (message.includes('timeout')) {
      return 'The provider may be experiencing downtime or network issues. Try again later or check the provider\'s status page.';
    }
    if (statusCode === 429 || message.includes('rate limit')) {
      return 'You\'ve hit the provider\'s rate limit. Wait a few minutes and try again, or consider upgrading your API plan.';
    }
    if (statusCode >= 500) {
      return 'The provider is experiencing server issues. Check their status page for updates on any ongoing incidents.';
    }
    if (message.includes('Unable to reach')) {
      return 'Could not connect to the provider API. Check if the base URL is correct and the provider is online.';
    }
    return null;
  };

  const suggestion = getErrorSuggestion(testResult.details.statusCode, testResult.message);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-admin-surface border-admin-border text-white max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            {testResult.success ? (
              <CheckCircle className="h-5 w-5 text-emerald-400" />
            ) : (
              <XCircle className="h-5 w-5 text-red-400" />
            )}
            Connection Test Results - {providerName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Summary Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Summary</h3>
            <div className="bg-admin-background rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Status</span>
                {testResult.success ? (
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Success
                  </Badge>
                ) : (
                  <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                    <XCircle className="h-3 w-3 mr-1" />
                    Failed
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Provider</span>
                <span className="text-white">{providerName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Test Time</span>
                <span className="text-slate-300">
                  {new Date(testResult.details.timestamp).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Response Time</span>
                <span className="text-white flex items-center gap-1">
                  <Clock className="h-3 w-3 text-slate-400" />
                  {testResult.responseTime}ms
                </span>
              </div>
            </div>
          </div>

          {/* Request Details Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Request Details</h3>
            <div className="bg-admin-background rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Endpoint Tested</span>
                <span className="text-slate-300 text-sm font-mono truncate max-w-[300px]" title={testResult.details.endpoint}>
                  <Globe className="h-3 w-3 inline mr-1" />
                  {testResult.details.endpoint || 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">HTTP Method</span>
                <Badge variant="outline" className="border-slate-500/30 text-slate-300 font-mono">
                  {testResult.details.method || 'GET'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Timeout</span>
                <span className="text-slate-300">10 seconds</span>
              </div>
            </div>
          </div>

          {/* Response Details Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Response Details</h3>
            <div className="bg-admin-background rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">HTTP Status Code</span>
                <Badge 
                  variant="outline" 
                  className={
                    testResult.details.statusCode >= 200 && testResult.details.statusCode < 300
                      ? 'border-emerald-500/30 text-emerald-400'
                      : testResult.details.statusCode >= 400
                      ? 'border-red-500/30 text-red-400'
                      : 'border-slate-500/30 text-slate-400'
                  }
                >
                  {testResult.details.statusCode || 'N/A'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Message</span>
                <span className={testResult.success ? 'text-emerald-400' : 'text-red-400'}>
                  {testResult.message}
                </span>
              </div>
              
              {testResult.details.errorDetails && (
                <div className="space-y-2">
                  <span className="text-slate-400 text-sm">Error Response:</span>
                  <pre className="bg-slate-900 rounded p-3 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap break-words max-h-32">
                    {testResult.details.errorDetails}
                  </pre>
                </div>
              )}

              {/* Suggestion for fixing the error */}
              {!testResult.success && suggestion && (
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-amber-200">
                      <span className="font-medium">Suggestion:</span> {suggestion}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions Section */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={onTestAgain}
              disabled={isRetesting}
              className="bg-admin-accent hover:bg-admin-accent-hover"
            >
              {isRetesting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Test Again
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={onEdit}
              className="border-admin-border text-slate-300 hover:bg-admin-surface-hover"
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Provider
            </Button>
            {!testResult.success && (
              <Button
                variant="outline"
                onClick={handleCopyError}
                className="border-admin-border text-slate-300 hover:bg-admin-surface-hover"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Error Details
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
