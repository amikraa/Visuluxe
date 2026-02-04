import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAvailableModels } from '@/hooks/useAvailableModels';
import { devLog } from '@/lib/logger';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Download, 
  RefreshCw, 
  Clock, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  X, 
  Cpu, 
  Calendar, 
  Activity, 
  ChevronDown, 
  ChevronUp,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { ImageMetadataExpanded, type RegenerateSettings } from './ImageMetadataExpanded';
import { ImageMetadataModal } from './ImageMetadataModal';
import { cn } from '@/lib/utils';

interface ImageHistoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegenerate?: (prompt: string, negativePrompt: string | null) => void;
  onRegenerateWithSeed?: (prompt: string, negativePrompt: string | null, seed: number) => void;
  onUseSettings?: (settings: RegenerateSettings) => void;
}

interface GeneratedImage {
  id: string;
  prompt: string;
  negative_prompt: string | null;
  image_url: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  credits_used: number;
  generation_time_ms: number | null;
  created_at: string;
  width: number | null;
  height: number | null;
  model_id: string | null;
}

export function ImageHistoryPanel({ open, onOpenChange, onRegenerate, onRegenerateWithSeed, onUseSettings }: ImageHistoryPanelProps) {
  const { user } = useAuth();
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalImageId, setModalImageId] = useState<string | null>(null);
  const expandedRef = useRef<HTMLDivElement>(null);

  // Fetch available models
  const { data: models } = useAvailableModels();

  // Fetch model usage counts for dropdown
  const { data: modelCounts } = useQuery({
    queryKey: ['user-model-counts', user?.id],
    queryFn: async () => {
      if (!user?.id) return { counts: {}, nullCount: 0 };

      const { data, error } = await supabase
        .from('images')
        .select('model_id')
        .eq('user_id', user.id);

      if (error) throw error;

      // Count images per model
      const counts: Record<string, number> = {};
      let nullCount = 0;

      data?.forEach(img => {
        if (img.model_id) {
          counts[img.model_id] = (counts[img.model_id] || 0) + 1;
        } else {
          nullCount++;
        }
      });

      return { counts, nullCount };
    },
    enabled: open && !!user?.id,
  });

  // Merge available models with models user has images from (for deleted models)
  const allModelsForFilter = useMemo(() => {
    const available = models || [];
    const usedModelIds = Object.keys(modelCounts?.counts || {});

    // Find model IDs that user has images from but aren't in available list
    const missingIds = usedModelIds.filter(
      id => !available.some(m => m.id === id)
    );

    // Add placeholder entries for missing/deleted models
    const missing = missingIds.map(id => ({
      id,
      name: 'Deleted Model',
      isDeleted: true
    }));

    // Combine and sort by usage count (most used first)
    const combined = [
      ...available.map(m => ({ ...m, isDeleted: false })),
      ...missing
    ].sort((a, b) => {
      const countA = modelCounts?.counts[a.id] || 0;
      const countB = modelCounts?.counts[b.id] || 0;
      return countB - countA;
    });

    return combined;
  }, [models, modelCounts]);

  const { data: images, isLoading, refetch } = useQuery({
    queryKey: ['user-image-history', dateFilter, statusFilter, modelFilter],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('images')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      // Date filter
      if (dateFilter !== 'all') {
        const now = new Date();
        let startDate: Date;
        
        switch (dateFilter) {
          case 'today':
            startDate = new Date(now.setHours(0, 0, 0, 0));
            break;
          case '7d':
            startDate = new Date(now.setDate(now.getDate() - 7));
            break;
          case '30d':
            startDate = new Date(now.setDate(now.getDate() - 30));
            break;
          default:
            startDate = new Date(0);
        }
        
        query = query.gte('created_at', startDate.toISOString());
      }

      // Model filter (server-side)
      if (modelFilter === 'null') {
        query = query.is('model_id', null);
      } else if (modelFilter !== 'all') {
        query = query.eq('model_id', modelFilter);
      }

      // Status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as GeneratedImage[];
    },
    enabled: open && !!user?.id,
  });

  // Scroll expanded card into view
  useEffect(() => {
    if (expandedId && expandedRef.current) {
      setTimeout(() => {
        expandedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [expandedId]);

  // Check if any filters are active
  const hasActiveFilters = dateFilter !== 'all' || modelFilter !== 'all' || statusFilter !== 'all';

  const clearAllFilters = () => {
    setDateFilter('all');
    setModelFilter('all');
    setStatusFilter('all');
  };

  // Get filter-aware empty message
  const getEmptyMessage = () => {
    const modelName = allModelsForFilter.find(m => m.id === modelFilter)?.name;

    if (modelFilter !== 'all' && statusFilter !== 'all') {
      return `No ${statusFilter} images generated with ${modelName}`;
    }
    if (modelFilter !== 'all') {
      return `No images generated with ${modelName}`;
    }
    if (statusFilter !== 'all') {
      return `No ${statusFilter} images found`;
    }
    if (dateFilter !== 'all') {
      return 'No images found in this time period';
    }
    return 'No images found';
  };

  // Get display name for date filter
  const getDateFilterLabel = (value: string) => {
    switch (value) {
      case 'today': return 'Today';
      case '7d': return 'Last 7 Days';
      case '30d': return 'Last 30 Days';
      default: return 'All Time';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case 'processing':
        return (
          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Processing
          </Badge>
        );
      default:
        return (
          <Badge className="bg-muted text-muted-foreground">
            {status}
          </Badge>
        );
    }
  };

  // Get model name by ID
  const getModelName = (modelId: string | null) => {
    if (!modelId) return 'Unknown Model';
    return allModelsForFilter.find(m => m.id === modelId)?.name || 'Unknown Model';
  };

  const handleDownload = async (imageUrl: string, imageName: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${imageName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      devLog.error('Download failed:', error);
    }
  };

  const handleToggleExpand = (imageId: string) => {
    setExpandedId(prev => prev === imageId ? null : imageId);
  };

  const handleUseSettings = (settings: RegenerateSettings) => {
    if (onUseSettings) {
      onUseSettings(settings);
      onOpenChange(false);
    }
  };

  const handleRegenerate = (prompt: string, negativePrompt: string | null) => {
    if (onRegenerate) {
      onRegenerate(prompt, negativePrompt);
      onOpenChange(false);
    }
  };

  const handleRegenerateWithSeed = (prompt: string, negativePrompt: string | null, seed: number) => {
    if (onRegenerateWithSeed) {
      onRegenerateWithSeed(prompt, negativePrompt, seed);
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg bg-surface border-border">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-foreground">Generation History</SheetTitle>
          <SheetDescription className="text-muted-foreground">
            View and manage your generated images
          </SheetDescription>
        </SheetHeader>

        {/* Filters - Responsive Layout */}
        <div className="flex flex-col gap-2 pb-4">
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Date Filter */}
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="flex-1 sm:w-[130px] bg-background border-border">
                <Calendar className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Date" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>

            {/* Model Filter */}
            <Select value={modelFilter} onValueChange={setModelFilter}>
              <SelectTrigger 
                className="flex-1 sm:w-[160px] bg-background border-border"
                aria-label="Filter images by AI model"
              >
                <Cpu className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
                <SelectValue placeholder="All Models" />
              </SelectTrigger>
              <SelectContent className="bg-popover max-h-[300px]">
                <SelectItem value="all">All Models</SelectItem>
                {(modelCounts?.nullCount ?? 0) > 0 && (
                  <SelectItem value="null">
                    <div className="flex items-center justify-between w-full gap-2">
                      <span className="text-muted-foreground">Unknown Model</span>
                      <span className="text-xs text-muted-foreground">
                        ({modelCounts?.nullCount})
                      </span>
                    </div>
                  </SelectItem>
                )}
                {allModelsForFilter.map(model => {
                  const count = modelCounts?.counts[model.id] || 0;
                  if (count === 0) return null;
                  return (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center justify-between w-full gap-2">
                        <span className={model.isDeleted ? 'text-muted-foreground italic' : ''}>
                          {model.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({count})
                        </span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="flex-1 sm:w-[130px] bg-background border-border">
                <Activity className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
              </SelectContent>
            </Select>

            {/* Action Buttons */}
            <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-muted-foreground">
                Clear All
              </Button>
            )}
          </div>
        </div>

        {/* Active Filter Badges */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 pb-4">
            {dateFilter !== 'all' && (
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                <Calendar className="h-3 w-3 mr-1" />
                {getDateFilterLabel(dateFilter)}
                <button 
                  onClick={() => setDateFilter('all')} 
                  className="ml-1 hover:text-blue-200 transition-colors"
                  aria-label="Clear date filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {modelFilter !== 'all' && (
              <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border-purple-500/20">
                <Cpu className="h-3 w-3 mr-1" />
                {modelFilter === 'null' ? 'Unknown Model' : getModelName(modelFilter)}
                <button 
                  onClick={() => setModelFilter('all')} 
                  className="ml-1 hover:text-purple-200 transition-colors"
                  aria-label="Clear model filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {statusFilter !== 'all' && (
              <Badge variant="secondary" className={
                statusFilter === 'completed' 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : statusFilter === 'failed'
                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }>
                <Activity className="h-3 w-3 mr-1" />
                {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                <button 
                  onClick={() => setStatusFilter('all')} 
                  className="ml-1 hover:opacity-70 transition-opacity"
                  aria-label="Clear status filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        )}

        {/* Results Count */}
        {images && images.length > 0 && (
          <p className="text-xs text-muted-foreground pb-2">
            Showing {images.length} {images.length === 1 ? 'image' : 'images'}
            {hasActiveFilters && ' (filtered)'}
          </p>
        )}

        {/* Image List */}
        <ScrollArea className="h-[calc(100vh-320px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : images && images.length > 0 ? (
            <div className="space-y-4 pr-4">
              {images.map((image) => {
                const isExpanded = expandedId === image.id;
                
                return (
                  <div
                    key={image.id}
                    ref={isExpanded ? expandedRef : undefined}
                    className="rounded-xl bg-background border border-border overflow-hidden"
                  >
                    {/* Main Card Content */}
                    <div className="p-4 space-y-3">
                      {/* Image Preview */}
                      {image.image_url && image.status === 'completed' && (
                        <div className="relative aspect-video rounded-lg overflow-hidden bg-surface">
                          <img
                            src={image.image_url}
                            alt={image.prompt.slice(0, 50)}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      {/* Prompt */}
                      <p className="text-sm text-foreground line-clamp-2">{image.prompt}</p>

                      {/* Metadata */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {getStatusBadge(image.status)}
                        
                        {/* Model Badge */}
                        {image.model_id && (
                          <Badge variant="outline" className="text-xs bg-background">
                            <Cpu className="h-3 w-3 mr-1" />
                            {getModelName(image.model_id)}
                          </Badge>
                        )}
                        
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(image.created_at), 'MMM d, h:mm a')}
                        </span>
                        {image.credits_used > 0 && (
                          <span>{image.credits_used} credits</span>
                        )}
                        {image.generation_time_ms && (
                          <span>{(image.generation_time_ms / 1000).toFixed(1)}s</span>
                        )}
                      </div>

                      {/* Actions Row */}
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex gap-2">
                          {image.status === 'completed' && image.image_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(image.image_url!, `image-${image.id.slice(0, 8)}`)}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download
                            </Button>
                          )}
                          {onRegenerate && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRegenerate(image.prompt, image.negative_prompt)}
                            >
                              <Sparkles className="h-3 w-3 mr-1" />
                              Regenerate
                            </Button>
                          )}
                        </div>
                        
                        {/* View Details & Expand Buttons */}
                        <div className="flex gap-1">
                          {/* View in Modal Button (Desktop) */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setModalImageId(image.id)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hidden sm:flex"
                            title="View full details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {/* Expand/Collapse Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleExpand(image.id)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className={cn(
                                  "h-4 w-4 mr-1 transition-transform duration-200"
                                )} />
                                Less
                              </>
                            ) : (
                              <>
                                <ChevronDown className={cn(
                                  "h-4 w-4 mr-1 transition-transform duration-200"
                                )} />
                                Details
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Metadata Section */}
                    {isExpanded && (
                      <ImageMetadataExpanded
                        imageId={image.id}
                        onRegenerate={onRegenerate ? handleRegenerate : undefined}
                        onRegenerateWithSeed={onRegenerateWithSeed ? handleRegenerateWithSeed : undefined}
                        onUseSettings={onUseSettings ? handleUseSettings : undefined}
                        onDownload={handleDownload}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>{getEmptyMessage()}</p>
              <p className="text-sm">
                {hasActiveFilters ? 'Try adjusting your filters' : 'Start generating to see your history here'}
              </p>
              {hasActiveFilters && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={clearAllFilters}
                  className="mt-4"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Image Details Modal */}
        <ImageMetadataModal
          imageId={modalImageId}
          open={modalImageId !== null}
          onOpenChange={(open) => !open && setModalImageId(null)}
          onRegenerate={onRegenerate ? handleRegenerate : undefined}
          onRegenerateWithSeed={onRegenerateWithSeed ? handleRegenerateWithSeed : undefined}
          onUseSettings={onUseSettings ? handleUseSettings : undefined}
          onDownload={handleDownload}
        />
      </SheetContent>
    </Sheet>
  );
}
