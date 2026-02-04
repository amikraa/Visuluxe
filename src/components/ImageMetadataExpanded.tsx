import { useState } from "react";
import { format } from "date-fns";
import { 
  Copy, 
  Check, 
  Download, 
  RefreshCw, 
  Wand2, 
  AlertCircle,
  Clock,
  Cpu,
  Image as ImageIcon,
  Hash,
  Sparkles,
  Layers,
  Server
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useImageDetails, type ImageDetails } from "@/hooks/useImageDetails";

interface ImageMetadataExpandedProps {
  imageId: string;
  onRegenerate?: (prompt: string, negativePrompt: string | null) => void;
  onRegenerateWithSeed?: (prompt: string, negativePrompt: string | null, seed: number) => void;
  onUseSettings?: (settings: RegenerateSettings) => void;
  onDownload?: (imageUrl: string, imageName: string) => void;
}

export interface RegenerateSettings {
  prompt: string;
  negativePrompt: string | null;
  modelId: string | null;
  width: number | null;
  height: number | null;
  steps: number | null;
  cfgScale: number | null;
  seed: number | null;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={handleCopy}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Copy {label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ParameterItem({ 
  icon: Icon, 
  label, 
  value, 
  copyable = false,
  mono = false 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string | number | null | undefined;
  copyable?: boolean;
  mono?: boolean;
}) {
  const displayValue = value ?? 'N/A';
  
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase">{label}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className={`text-sm ${mono ? 'font-mono' : ''}`}>
          {displayValue}
        </span>
        {copyable && value && (
          <CopyButton value={String(value)} label={label} />
        )}
      </div>
    </div>
  );
}

export function ImageMetadataExpanded({
  imageId,
  onRegenerate,
  onRegenerateWithSeed,
  onUseSettings,
  onDownload,
}: ImageMetadataExpandedProps) {
  const { data: details, isLoading, error } = useImageDetails(imageId);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 bg-muted/30 border-t border-border">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="p-4 bg-muted/30 border-t border-border">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load image details. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleCopyParameters = async () => {
    const params = {
      prompt: details.prompt,
      negative_prompt: details.negative_prompt,
      model: details.model_name,
      width: details.width,
      height: details.height,
      seed: details.metadata?.seed,
      cfg_scale: details.metadata?.cfg_scale,
      steps: details.metadata?.steps,
    };
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(params, null, 2));
      toast.success("Parameters copied to clipboard");
    } catch (err) {
      toast.error("Failed to copy parameters");
    }
  };

  const handleUseSettings = () => {
    if (onUseSettings) {
      onUseSettings({
        prompt: details.prompt,
        negativePrompt: details.negative_prompt,
        modelId: details.model_id,
        width: details.width,
        height: details.height,
        steps: details.metadata?.steps ?? null,
        cfgScale: details.metadata?.cfg_scale ?? null,
        seed: details.metadata?.seed ?? null,
      });
    }
  };

  const handleDownload = () => {
    if (onDownload && details.image_url) {
      onDownload(details.image_url, `image-${details.id}`);
    }
  };

  const statusColors = {
    completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    failed: 'bg-destructive/20 text-destructive border-destructive/30',
    pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    processing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    cancelled: 'bg-muted text-muted-foreground border-muted',
  };

  return (
    <div className="p-4 space-y-4 bg-muted/30 border-t border-border animate-in slide-in-from-top-2 duration-300">
      {/* Section 1: Generation Parameters */}
      <div>
        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
          Generation Parameters
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 bg-background/50 rounded-lg p-3">
          <div className="space-y-1">
            <ParameterItem 
              icon={Cpu} 
              label="Model" 
              value={details.model_name || 'Unknown Model'} 
            />
            <ParameterItem 
              icon={ImageIcon} 
              label="Size" 
              value={details.width && details.height ? `${details.width} × ${details.height}` : null} 
            />
            <ParameterItem 
              icon={Hash} 
              label="Seed" 
              value={details.metadata?.seed} 
              copyable 
              mono 
            />
            <ParameterItem 
              icon={Layers} 
              label="Num Images" 
              value={details.metadata?.num_images || 1} 
              mono 
            />
          </div>
          <div className="space-y-1">
            <ParameterItem 
              icon={Sparkles} 
              label="CFG Scale" 
              value={details.metadata?.cfg_scale || 7} 
              mono 
            />
            <ParameterItem 
              icon={Layers} 
              label="Steps" 
              value={details.metadata?.steps || 'Default'} 
              mono 
            />
            <ParameterItem 
              icon={Clock} 
              label="Created" 
              value={format(new Date(details.created_at), 'MMM d, yyyy HH:mm')} 
            />
            <ParameterItem 
              icon={Sparkles} 
              label="Credits Used" 
              value={details.credits_used} 
              mono 
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Section 2: Prompts */}
      <div>
        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
          Prompts
        </h4>
        <div className="space-y-3">
          <div className="bg-background/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Positive Prompt</span>
              <CopyButton value={details.prompt} label="prompt" />
            </div>
            <p className="text-sm font-mono whitespace-pre-wrap break-words text-foreground/90">
              {details.prompt}
            </p>
          </div>
          
          <div className="bg-background/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Negative Prompt</span>
              {details.negative_prompt && (
                <CopyButton value={details.negative_prompt} label="negative prompt" />
              )}
            </div>
            <p className="text-sm font-mono whitespace-pre-wrap break-words text-foreground/90">
              {details.negative_prompt || <span className="text-muted-foreground italic">None</span>}
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Section 3: Status & Error Information */}
      <div>
        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
          Status Information
        </h4>
        <div className="bg-background/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Status</span>
            <Badge className={statusColors[details.status]}>
              {details.status.charAt(0).toUpperCase() + details.status.slice(1)}
            </Badge>
          </div>
          
          {details.generation_time_ms && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Response Time</span>
              <span className="text-sm font-mono">
                {(details.generation_time_ms / 1000).toFixed(2)}s
              </span>
            </div>
          )}
          
          {details.provider_name && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Provider</span>
              <div className="flex items-center gap-1 text-sm">
                <Server className="h-3 w-3" />
                {details.provider_name}
              </div>
            </div>
          )}
          
          {details.status === 'failed' && details.error && (
            <Alert variant="destructive" className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {details.error}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      <Separator />

      {/* Section 4: Actions */}
      <div className="flex flex-wrap gap-2">
        {details.status === 'completed' && details.image_url && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="gap-1"
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
        )}
        
        {onRegenerate && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <RefreshCw className="h-4 w-4" />
                Regenerate
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem 
                onClick={() => {
                  if (details.metadata?.seed && onRegenerateWithSeed) {
                    onRegenerateWithSeed(details.prompt, details.negative_prompt, details.metadata.seed);
                  } else {
                    onRegenerate(details.prompt, details.negative_prompt);
                  }
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate Exact (Same Seed)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRegenerate(details.prompt, details.negative_prompt)}>
                <Sparkles className="h-4 w-4 mr-2" />
                Regenerate with New Seed
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyParameters}
          className="gap-1"
        >
          <Copy className="h-4 w-4" />
          Copy Parameters
        </Button>
        
        {onUseSettings && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleUseSettings}
            className="gap-1"
          >
            <Wand2 className="h-4 w-4" />
            Use These Settings
          </Button>
        )}
      </div>
    </div>
  );
}
