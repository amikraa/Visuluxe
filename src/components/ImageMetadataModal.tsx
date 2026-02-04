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
  Server,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useImageDetails } from "@/hooks/useImageDetails";
import type { RegenerateSettings } from "./ImageMetadataExpanded";

interface ImageMetadataModalProps {
  imageId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegenerate?: (prompt: string, negativePrompt: string | null) => void;
  onRegenerateWithSeed?: (prompt: string, negativePrompt: string | null, seed: number) => void;
  onUseSettings?: (settings: RegenerateSettings) => void;
  onDownload?: (imageUrl: string, imageName: string) => void;
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

function ParameterRow({ 
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
    <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-sm font-medium">{label}</span>
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

export function ImageMetadataModal({
  imageId,
  open,
  onOpenChange,
  onRegenerate,
  onRegenerateWithSeed,
  onUseSettings,
  onDownload,
}: ImageMetadataModalProps) {
  const { data: details, isLoading, error } = useImageDetails(imageId);

  const handleCopyParameters = async () => {
    if (!details) return;
    
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
    if (onUseSettings && details) {
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
      onOpenChange(false);
    }
  };

  const handleDownload = () => {
    if (onDownload && details?.image_url) {
      onDownload(details.image_url, `image-${details.id}`);
    }
  };

  const handleRegenerate = (useSameSeed: boolean) => {
    if (!details) return;
    
    if (useSameSeed && details.metadata?.seed && onRegenerateWithSeed) {
      onRegenerateWithSeed(details.prompt, details.negative_prompt, details.metadata.seed);
    } else if (onRegenerate) {
      onRegenerate(details.prompt, details.negative_prompt);
    }
    onOpenChange(false);
  };

  const statusColors: Record<string, string> = {
    completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    failed: 'bg-destructive/20 text-destructive border-destructive/30',
    pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    processing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    cancelled: 'bg-muted text-muted-foreground border-muted',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Image Generation Details</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 p-4">
            <Skeleton className="h-64 w-full rounded-lg" />
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
        ) : error || !details ? (
          <div className="p-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load image details. Please try again.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Large Image Preview */}
            {details.status === 'completed' && details.image_url && (
              <div className="relative bg-muted/30 rounded-lg overflow-hidden mb-4">
                <img
                  src={details.image_url}
                  alt={details.prompt.slice(0, 50)}
                  className="w-full max-h-80 object-contain mx-auto"
                />
              </div>
            )}

            {/* Tabbed Interface */}
            <Tabs defaultValue="parameters" className="w-full">
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="parameters">Parameters</TabsTrigger>
                <TabsTrigger value="prompts">Prompts</TabsTrigger>
                <TabsTrigger value="status">Status</TabsTrigger>
                <TabsTrigger value="actions">Actions</TabsTrigger>
              </TabsList>

              {/* Parameters Tab */}
              <TabsContent value="parameters" className="mt-4 space-y-1">
                <div className="bg-muted/30 rounded-lg p-4">
                  <ParameterRow 
                    icon={Cpu} 
                    label="Model" 
                    value={details.model_name || 'Unknown Model'} 
                  />
                  <ParameterRow 
                    icon={ImageIcon} 
                    label="Image Size" 
                    value={details.width && details.height ? `${details.width} × ${details.height}` : null} 
                  />
                  <ParameterRow 
                    icon={Hash} 
                    label="Seed" 
                    value={details.metadata?.seed} 
                    copyable 
                    mono 
                  />
                  <ParameterRow 
                    icon={Layers} 
                    label="Number of Images" 
                    value={details.metadata?.num_images || 1} 
                    mono 
                  />
                  <ParameterRow 
                    icon={Sparkles} 
                    label="CFG Scale" 
                    value={details.metadata?.cfg_scale || 7} 
                    mono 
                  />
                  <ParameterRow 
                    icon={Layers} 
                    label="Steps" 
                    value={details.metadata?.steps || 'Default'} 
                    mono 
                  />
                  <ParameterRow 
                    icon={Clock} 
                    label="Created" 
                    value={format(new Date(details.created_at), 'MMM d, yyyy HH:mm')} 
                  />
                  <ParameterRow 
                    icon={Sparkles} 
                    label="Credits Used" 
                    value={details.credits_used} 
                    mono 
                  />
                </div>
              </TabsContent>

              {/* Prompts Tab */}
              <TabsContent value="prompts" className="mt-4 space-y-4">
                <div className="bg-muted/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Positive Prompt</span>
                    <CopyButton value={details.prompt} label="prompt" />
                  </div>
                  <p className="text-sm font-mono whitespace-pre-wrap break-words text-foreground/90 bg-background/50 rounded p-3">
                    {details.prompt}
                  </p>
                </div>
                
                <div className="bg-muted/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Negative Prompt</span>
                    {details.negative_prompt && (
                      <CopyButton value={details.negative_prompt} label="negative prompt" />
                    )}
                  </div>
                  <p className="text-sm font-mono whitespace-pre-wrap break-words text-foreground/90 bg-background/50 rounded p-3">
                    {details.negative_prompt || <span className="text-muted-foreground italic">None</span>}
                  </p>
                </div>
              </TabsContent>

              {/* Status Tab */}
              <TabsContent value="status" className="mt-4">
                <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium text-muted-foreground">Generation Status</span>
                    <Badge className={statusColors[details.status]}>
                      {details.status.charAt(0).toUpperCase() + details.status.slice(1)}
                    </Badge>
                  </div>
                  
                  {details.generation_time_ms && (
                    <div className="flex items-center justify-between py-2 border-t border-border/50">
                      <span className="text-sm font-medium text-muted-foreground">Response Time</span>
                      <span className="text-sm font-mono">
                        {(details.generation_time_ms / 1000).toFixed(2)}s
                      </span>
                    </div>
                  )}
                  
                  {details.provider_name && (
                    <div className="flex items-center justify-between py-2 border-t border-border/50">
                      <span className="text-sm font-medium text-muted-foreground">Provider Used</span>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Server className="h-4 w-4 text-muted-foreground" />
                        {details.provider_name}
                      </div>
                    </div>
                  )}
                  
                  {details.status === 'failed' && details.error && (
                    <Alert variant="destructive" className="mt-3">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {details.error}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </TabsContent>

              {/* Actions Tab */}
              <TabsContent value="actions" className="mt-4">
                <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {details.status === 'completed' && details.image_url && (
                      <Button
                        variant="outline"
                        onClick={handleDownload}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Download Image
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      onClick={handleCopyParameters}
                      className="gap-2"
                    >
                      <Copy className="h-4 w-4" />
                      Copy Parameters
                    </Button>
                    
                    {onRegenerate && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Regenerate
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => handleRegenerate(true)}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Same Seed
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRegenerate(false)}>
                            <Sparkles className="h-4 w-4 mr-2" />
                            New Seed
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    
                    {onUseSettings && (
                      <Button
                        variant="secondary"
                        onClick={handleUseSettings}
                        className="gap-2"
                      >
                        <Wand2 className="h-4 w-4" />
                        Use These Settings
                      </Button>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}