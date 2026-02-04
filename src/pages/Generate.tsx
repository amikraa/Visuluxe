import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { GlobalNavbar } from '@/components/GlobalNavbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Wand2, Settings2, ImageIcon, Download, History, RefreshCw, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserCredits } from '@/hooks/useUserCredits';
import { useAvailableModels } from '@/hooks/useAvailableModels';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { ImageHistoryPanel } from '@/components/ImageHistoryPanel';
import { type RegenerateSettings } from '@/components/ImageMetadataExpanded';
import { LoadingSkeleton, ErrorBoundary, EmptyState } from '@/components/shared';

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  model: string;
  created_at: string;
}

interface GenerationError {
  type: 'insufficient_credits' | 'rate_limit' | 'maintenance' | 'validation' | 'generic';
  message: string;
  details?: {
    required?: number;
    available?: number;
    retryAfter?: number;
  };
}

export default function Generate() {
  const { user } = useAuth();
  const { data: credits, refetch: refetchCredits } = useUserCredits();
  const { data: availableModels, isLoading: modelsLoading } = useAvailableModels();
  const queryClient = useQueryClient();
  
  // Form state
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [steps, setSteps] = useState(30);
  const [cfgScale, setCfgScale] = useState(7);
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [imageCount, setImageCount] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<GenerationError | null>(null);
  const [retryCountdown, setRetryCountdown] = useState(0);
  
  // History panel state
  const [historyOpen, setHistoryOpen] = useState(false);
  
  // Ref for form flash animation
  const formRef = useRef<HTMLDivElement>(null);

  // Set default model when models load
  useEffect(() => {
    if (availableModels && availableModels.length > 0 && !selectedModel) {
      setSelectedModel(availableModels[0].id);
    }
  }, [availableModels, selectedModel]);

  // Handle rate limit countdown
  useEffect(() => {
    if (retryCountdown > 0) {
      const timer = setTimeout(() => setRetryCountdown(retryCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [retryCountdown]);

  // Get selected model details
  const currentModel = availableModels?.find(m => m.id === selectedModel);
  const creditCost = currentModel ? currentModel.credits_cost * imageCount : 0;
  const totalCredits = (credits?.balance || 0) + (credits?.daily_credits || 0);
  const hasEnoughCredits = totalCredits >= creditCost;

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    if (!selectedModel) {
      toast.error('Please select a model');
      return;
    }

    if (!hasEnoughCredits) {
      setError({
        type: 'insufficient_credits',
        message: 'You don\'t have enough credits for this generation',
        details: {
          required: creditCost,
          available: totalCredits
        }
      });
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('generate-image', {
        body: {
          prompt: prompt.trim(),
          negative_prompt: negativePrompt.trim() || undefined,
          model_id: selectedModel,
          width,
          height,
          steps,
          cfg_scale: cfgScale,
          seed: seed || undefined,
          num_images: imageCount
        }
      });

      if (invokeError) {
        throw invokeError;
      }

      if (data?.error) {
        // Handle specific error codes
        const status = data.status || 500;
        
        if (status === 402) {
          setError({
            type: 'insufficient_credits',
            message: data.error,
            details: {
              required: data.required_credits,
              available: data.available_credits
            }
          });
        } else if (status === 429) {
          const retryAfter = data.retry_after || 60;
          setRetryCountdown(retryAfter);
          setError({
            type: 'rate_limit',
            message: data.error,
            details: { retryAfter }
          });
        } else if (status === 503) {
          setError({
            type: 'maintenance',
            message: data.error || 'System is under maintenance. Please try again later.'
          });
        } else if (status === 400) {
          setError({
            type: 'validation',
            message: data.error
          });
        } else {
          setError({
            type: 'generic',
            message: data.error || 'An unexpected error occurred'
          });
        }
        return;
      }

      // Success - add generated images
      if (data?.images && Array.isArray(data.images)) {
        const newImages: GeneratedImage[] = data.images.map((img: any) => ({
          id: img.id || crypto.randomUUID(),
          url: img.url || img.image_url,
          prompt: prompt,
          model: currentModel?.name || 'Unknown',
          created_at: new Date().toISOString()
        }));
        
        setGeneratedImages(prev => [...newImages, ...prev]);
        toast.success(`Generated ${newImages.length} image${newImages.length > 1 ? 's' : ''}!`);
      } else if (data?.image_url) {
        // Single image response
        const newImage: GeneratedImage = {
          id: data.id || crypto.randomUUID(),
          url: data.image_url,
          prompt: prompt,
          model: currentModel?.name || 'Unknown',
          created_at: new Date().toISOString()
        };
        
        setGeneratedImages(prev => [newImage, ...prev]);
        toast.success('Image generated successfully!');
      }

      // Refresh credits after successful generation
      await refetchCredits();
      queryClient.invalidateQueries({ queryKey: ['user-image-stats'] });

    } catch (err: any) {
      console.error('Generation error:', err);
      setError({
        type: 'generic',
        message: err.message || 'Failed to generate image. Please try again.'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    handleGenerate();
  };

  const handleRegenerate = (regeneratePrompt: string, regenerateNegativePrompt?: string | null) => {
    setPrompt(regeneratePrompt);
    if (regenerateNegativePrompt) {
      setNegativePrompt(regenerateNegativePrompt);
    }
    setHistoryOpen(false);
    toast.info('Prompt loaded! Click Generate to create a new image.');
  };

  const handleRegenerateWithSeed = (regeneratePrompt: string, regenerateNegativePrompt: string | null, regenerateSeed: number) => {
    setPrompt(regeneratePrompt);
    setNegativePrompt(regenerateNegativePrompt || '');
    setSeed(regenerateSeed);
    setShowAdvanced(true);
    setHistoryOpen(false);
    toast.info('Prompt and seed loaded! Click Generate to recreate this exact image.');
  };

  const handleUseSettings = (settings: RegenerateSettings) => {
    // Set all form fields from the settings
    setPrompt(settings.prompt);
    setNegativePrompt(settings.negativePrompt || '');
    
    if (settings.modelId) {
      setSelectedModel(settings.modelId);
    }
    
    if (settings.width && settings.height) {
      setWidth(settings.width);
      setHeight(settings.height);
    }
    
    if (settings.steps !== null) {
      setSteps(settings.steps);
    }
    
    if (settings.cfgScale !== null) {
      setCfgScale(settings.cfgScale);
    }
    
    if (settings.seed !== null) {
      setSeed(settings.seed);
    }
    
    // Show advanced settings since we're loading them
    setShowAdvanced(true);
    
    // Close history panel
    setHistoryOpen(false);
    
    // Scroll to form and flash it
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      // Add flash animation
      if (formRef.current) {
        formRef.current.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background');
        setTimeout(() => {
          formRef.current?.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background');
        }, 1500);
      }
    }, 100);
    
    toast.success('All settings loaded! Click Generate to create a new image.');
  };

  const handleDownload = async (imageUrl: string, imageId: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `generated-${imageId}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Image downloaded!');
    } catch {
      toast.error('Failed to download image');
    }
  };

  const aspectRatios = [
    { label: '1:1', width: 1024, height: 1024 },
    { label: '16:9', width: 1344, height: 768 },
    { label: '9:16', width: 768, height: 1344 },
    { label: '4:3', width: 1152, height: 896 },
    { label: '3:4', width: 896, height: 1152 },
  ];

  const renderError = () => {
    if (!error) return null;

    return (
      <Card className="p-4 border-destructive/50 bg-destructive/10 mb-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">{error.message}</p>
            
            {error.type === 'insufficient_credits' && error.details && (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Required: {error.details.required} credits • Available: {error.details.available} credits
                </p>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/pricing">Buy Credits</Link>
                </Button>
              </div>
            )}
            
            {error.type === 'rate_limit' && retryCountdown > 0 && (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Try again in {retryCountdown} seconds</span>
              </div>
            )}
            
            {(error.type === 'generic' || error.type === 'validation') && (
              <Button size="sm" variant="outline" className="mt-2" onClick={handleRetry}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <ErrorBoundary sectionName="Generate">
    <div className="min-h-screen bg-background">
      <GlobalNavbar />
      
      <main className="pt-24 pb-16 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">AI Image Generation</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold font-display mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Create Stunning Images
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Transform your ideas into beautiful visuals with our advanced AI models
            </p>
          </div>

          {/* Error Display */}
          {renderError()}

          <div className="grid lg:grid-cols-[1fr,1.5fr] gap-8">
            {/* Left Panel - Controls */}
            <div className="space-y-6">
              {/* Prompt Input */}
              <Card ref={formRef} className="p-6 glass transition-all duration-300">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="prompt" className="text-sm font-medium mb-2 block">
                      Prompt
                    </Label>
                    <Textarea
                      id="prompt"
                      placeholder="Describe the image you want to create..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      disabled={isGenerating}
                      className="min-h-[120px] resize-none bg-surface border-border/50 focus:border-primary/50"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="negative" className="text-sm font-medium mb-2 block">
                      Negative Prompt <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Textarea
                      id="negative"
                      placeholder="What to avoid in the image..."
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                      disabled={isGenerating}
                      className="min-h-[80px] resize-none bg-surface border-border/50 focus:border-primary/50"
                    />
                  </div>
                </div>
              </Card>

              {/* Model Selection */}
              <Card className="p-6 glass">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Model</Label>
                    <Select 
                      value={selectedModel} 
                      onValueChange={setSelectedModel}
                      disabled={isGenerating || modelsLoading}
                    >
                      <SelectTrigger className="bg-surface border-border/50">
                        <SelectValue placeholder={modelsLoading ? "Loading models..." : "Select a model"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels?.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            <div className="flex items-center justify-between w-full gap-4">
                              <span>{model.name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {model.credits_cost} credits
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {currentModel?.description && (
                      <p className="text-xs text-muted-foreground mt-2">{currentModel.description}</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-2 block">Aspect Ratio</Label>
                    <div className="flex flex-wrap gap-2">
                      {aspectRatios.map((ratio) => (
                        <Button
                          key={ratio.label}
                          variant={width === ratio.width && height === ratio.height ? "default" : "outline"}
                          size="sm"
                          disabled={isGenerating}
                          onClick={() => {
                            setWidth(ratio.width);
                            setHeight(ratio.height);
                          }}
                          className="flex-1 min-w-[60px]"
                        >
                          {ratio.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-2 block">Number of Images</Label>
                    <div className="flex gap-2">
                      {[1, 2, 4].map((num) => (
                        <Button
                          key={num}
                          variant={imageCount === num ? "default" : "outline"}
                          size="sm"
                          disabled={isGenerating}
                          onClick={() => setImageCount(num)}
                          className="flex-1"
                        >
                          {num}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Advanced Settings */}
              <Card className="p-6 glass">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  disabled={isGenerating}
                  className="w-full flex items-center justify-between text-sm font-medium"
                >
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4" />
                    Advanced Settings
                  </div>
                  <span className="text-muted-foreground">{showAdvanced ? '−' : '+'}</span>
                </button>
                
                {showAdvanced && (
                  <div className="mt-4 space-y-4 pt-4 border-t border-border/50">
                    <div>
                      <div className="flex justify-between mb-2">
                        <Label className="text-sm">CFG Scale</Label>
                        <span className="text-sm text-muted-foreground">{cfgScale}</span>
                      </div>
                      <Slider
                        value={[cfgScale]}
                        onValueChange={([v]) => setCfgScale(v)}
                        min={1}
                        max={20}
                        step={0.5}
                        disabled={isGenerating}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Higher values = more prompt adherence</p>
                    </div>
                    
                    <div>
                      <div className="flex justify-between mb-2">
                        <Label className="text-sm">Steps</Label>
                        <span className="text-sm text-muted-foreground">{steps}</span>
                      </div>
                      <Slider
                        value={[steps]}
                        onValueChange={([v]) => setSteps(v)}
                        min={10}
                        max={50}
                        step={1}
                        disabled={isGenerating}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground mt-1">More steps = higher quality, slower generation</p>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Seed (optional)</Label>
                      <Input
                        type="number"
                        placeholder="Random"
                        value={seed || ''}
                        onChange={(e) => setSeed(e.target.value ? parseInt(e.target.value) : undefined)}
                        disabled={isGenerating}
                        className="bg-surface border-border/50"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Use same seed for reproducible results</p>
                    </div>
                  </div>
                )}
              </Card>

              {/* Generate Button */}
              <div className="space-y-3">
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim() || !selectedModel || !hasEnoughCredits || retryCountdown > 0}
                  className="w-full h-14 text-lg font-bold bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-glow"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : retryCountdown > 0 ? (
                    <>
                      <Clock className="w-5 h-5 mr-2" />
                      Wait {retryCountdown}s
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5 mr-2" />
                      Generate
                      {creditCost > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          -{creditCost} credits
                        </Badge>
                      )}
                    </>
                  )}
                </Button>
                
                {!hasEnoughCredits && creditCost > 0 && (
                  <p className="text-xs text-center text-destructive">
                    Insufficient credits. You need {creditCost} but have {totalCredits.toFixed(1)}.
                  </p>
                )}
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setHistoryOpen(true)}
                    disabled={isGenerating}
                  >
                    <History className="w-4 h-4 mr-2" />
                    History
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    disabled={isGenerating || generatedImages.length === 0}
                    onClick={() => {
                      if (generatedImages.length > 0) {
                        handleDownload(generatedImages[0].url, generatedImages[0].id);
                      }
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            </div>

            {/* Right Panel - Generated Images */}
            <div className="space-y-6">
              <Card className="p-6 glass min-h-[600px]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Generated Images</h3>
                  {generatedImages.length > 0 && (
                    <Badge variant="secondary">{generatedImages.length} images</Badge>
                  )}
                </div>
                
                {isGenerating ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-muted-foreground">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                      <Sparkles className="w-8 h-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <p className="mt-6 text-lg font-medium">Generating your image...</p>
                    <p className="text-sm text-muted-foreground mt-2">This may take a few moments</p>
                  </div>
                ) : modelsLoading ? (
                  <div className="h-[500px]">
                    <LoadingSkeleton variant="card" />
                  </div>
                ) : generatedImages.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {generatedImages.map((image) => (
                      <div key={image.id} className="relative group rounded-xl overflow-hidden bg-surface border border-border/50">
                        <img
                          src={image.url}
                          alt={image.prompt}
                          className="w-full aspect-square object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <p className="text-xs text-foreground line-clamp-2 mb-2">{image.prompt}</p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="flex-1"
                                onClick={() => handleDownload(image.url, image.id)}
                              >
                                <Download className="w-3 h-3 mr-1" />
                                Download
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-[500px] flex items-center justify-center">
                    <EmptyState
                      icon={ImageIcon}
                      title="No images yet"
                      description="Enter a prompt and click Generate to create your first image"
                    />
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Image History Panel */}
      <ImageHistoryPanel
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onRegenerate={handleRegenerate}
        onRegenerateWithSeed={handleRegenerateWithSeed}
        onUseSettings={handleUseSettings}
      />
    </div>
    </ErrorBoundary>
  );
}
