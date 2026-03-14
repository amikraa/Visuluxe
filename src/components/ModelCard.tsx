import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, Eye, EyeOff, Settings, Globe, Zap, Shield, Code, Clock, DollarSign } from 'lucide-react';

interface ModelCardProps {
  model: {
    id: string;
    model_id: string;
    name: string;
    description: string;
    tier: string;
    capabilities: Record<string, boolean>;
    max_images: number;
    supports_i2i: boolean;
    processing_type: string;
    max_wait_time: string;
    supported_sizes: string[];
    status: string;
    providers: Array<{
      id: string;
      provider_id: string;
      provider_name: string;
      provider_model_id: string;
      provider_cost: number;
      platform_price: number;
      max_images_supported: number;
      status: string;
    }>;
  };
  onClick: () => void;
  onGenerate: () => void;
}

const getCapabilityIcon = (capability: string) => {
  switch (capability) {
    case 'text_to_image': return <Sparkles className="h-3 w-3" />;
    case 'image_to_image': return <Eye className="h-3 w-3" />;
    case 'inpainting': return <Settings className="h-3 w-3" />;
    default: return <Code className="h-3 w-3" />;
  }
};

const getProviderIcon = (provider: string) => {
  switch (provider.toLowerCase()) {
    case 'flux': return <Zap className="h-3 w-3" />;
    case 'openai': return <Globe className="h-3 w-3" />;
    case 'stability': return <Shield className="h-3 w-3" />;
    default: return <Code className="h-3 w-3" />;
  }
};

export function ModelCard({ model, onClick, onGenerate }: ModelCardProps) {
  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Free': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Pro': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getTierGlow = (tier: string) => {
    switch (tier) {
      case 'Free': return 'shadow-[0_0_15px_rgba(34,197,94,0.3)]';
      case 'Pro': return 'shadow-[0_0_15px_rgba(168,85,247,0.3)]';
      default: return 'shadow-[0_0_15px_rgba(156,163,175,0.3)]';
    }
  };

  const minPrice = Math.min(...model.providers.map(p => p.platform_price));
  const hasI2ISupport = model.supports_i2i;

  return (
    <div 
      className={`group relative bg-gradient-to-br from-gray-900/50 to-gray-800/30 border border-gray-600/50 rounded-xl p-6 hover:border-gray-500/80 transition-all duration-300 cursor-pointer transform hover:-translate-y-1 hover:shadow-3d hover:shadow-glow ${getTierGlow(model.tier)}`}
      onClick={onClick}
    >
      {/* Tier Badge */}
      <div className="absolute top-4 right-4">
        <Badge className={`text-xs font-semibold px-2 py-1 ${getTierColor(model.tier)} border`}>
          {model.tier}
        </Badge>
      </div>

      {/* Model Header */}
      <div className="mb-4">
        <h3 className="text-lg font-bold text-white mb-1 group-hover:text-accent transition-colors">
          {model.name}
        </h3>
        <p className="text-sm text-gray-400 font-mono">{model.model_id}</p>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-300 mb-4 leading-relaxed">
        {model.description}
      </p>

      {/* Capabilities */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
          {Object.entries(model.capabilities).slice(0, 3).map(([key, value]) => (
            value && (
              <Badge key={key} variant="outline" className="text-xs bg-gray-800/50 border-gray-600/50 text-gray-300 hover:bg-gray-700/50 transition-colors">
                {getCapabilityIcon(key)}
                <span className="ml-1 capitalize">{key.replace('_', ' ')}</span>
              </Badge>
            )
          ))}
          {Object.values(model.capabilities).filter(v => v).length > 3 && (
            <Badge variant="outline" className="text-xs bg-gray-800/50 border-gray-600/50 text-gray-300 hover:bg-gray-700/50 transition-colors">
              +{Object.values(model.capabilities).filter(v => v).length - 3} more
            </Badge>
          )}
        </div>
      </div>

      {/* Supported Sizes */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-1">
          <span className="text-xs text-gray-400 mr-2">Sizes:</span>
          {model.supported_sizes.slice(0, 3).map((size: string) => (
            <Badge key={size} variant="secondary" className="text-xs bg-gray-800/50 border-gray-600/50 text-gray-300 hover:bg-gray-700/50 transition-colors">
              {size}
            </Badge>
          ))}
          {model.supported_sizes.length > 3 && (
            <Badge variant="secondary" className="text-xs bg-gray-800/50 border-gray-600/50 text-gray-300 hover:bg-gray-700/50 transition-colors">
              +{model.supported_sizes.length - 3}
            </Badge>
          )}
        </div>
      </div>

      {/* Provider Support */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
          {model.providers.map((provider) => (
            <Badge key={provider.provider_id} variant="default" className="text-xs bg-gray-800/50 border-gray-600/50 text-gray-300 hover:bg-gray-700/50 transition-colors">
              {getProviderIcon(provider.provider_name)}
              <span className="ml-1 capitalize">{provider.provider_name}</span>
            </Badge>
          ))}
        </div>
      </div>

      {/* Model Limits */}
      <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
        <div className="flex items-center gap-2 text-gray-400">
          <Clock className="w-3 h-3" />
          <span>Max: {model.max_images} image{model.max_images > 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <Clock className="w-3 h-3" />
          <span>Wait: {model.max_wait_time}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <EyeOff className="w-3 h-3" />
          <span>I2I: {hasI2ISupport ? 'Yes' : 'No'}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <Clock className="w-3 h-3" />
          <span>Type: {model.processing_type}</span>
        </div>
      </div>

      {/* Pricing */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-700/50 mb-4">
        <div className="text-xs text-gray-400">Starting at</div>
        <div className="flex items-center gap-2">
          <DollarSign className="h-3 w-3 text-green-400" />
          <span className="text-green-400 font-bold text-sm">
            {minPrice} credits
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 border-gray-600/50 text-gray-300 hover:bg-gray-700/50 hover:border-gray-500/50 transition-all duration-300"
        >
          <Code className="h-3 w-3 mr-2" />
          View Details
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onGenerate();
          }}
          className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground transition-all duration-300 shadow-glow hover:shadow-glow-lg"
        >
          <Sparkles className="h-3 w-3 mr-2" />
          Generate
        </Button>
      </div>

      {/* Hover Overlay */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-transparent via-transparent to-gray-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </div>
  );
}