import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Eye, EyeOff, Settings, Globe, Zap, Shield, Code, Clock, DollarSign, Globe2, Copy, Check } from 'lucide-react';
import { CodeBlock } from './CodeBlock';
import { InfoBox } from './InfoBox';

interface ModelModalProps {
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
  isOpen: boolean;
  onClose: () => void;
  onGenerate: () => void;
}

const getCapabilityIcon = (capability: string) => {
  switch (capability) {
    case 'text_to_image': return <Sparkles className="h-4 w-4" />;
    case 'image_to_image': return <Eye className="h-4 w-4" />;
    case 'inpainting': return <Settings className="h-4 w-4" />;
    default: return <Code className="h-4 w-4" />;
  }
};

const getProviderIcon = (provider: string) => {
  switch (provider.toLowerCase()) {
    case 'flux': return <Zap className="h-4 w-4" />;
    case 'openai': return <Globe className="h-4 w-4" />;
    case 'stability': return <Shield className="h-4 w-4" />;
    default: return <Code className="h-4 w-4" />;
  }
};

export function ModelModal({ model, isOpen, onClose, onGenerate }: ModelModalProps) {
  if (!isOpen || !model) return null;

  const minPrice = Math.min(...model.providers.map(p => p.platform_price));
  const hasI2ISupport = model.supports_i2i;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-600/50 rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-3d shadow-glow">
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-700/50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">{model.name}</h2>
              <p className="text-gray-400 font-mono text-sm">Model ID: {model.model_id}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={`text-xs font-semibold px-2 py-1 ${
                  model.tier === 'Free' 
                    ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                    : 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                }`}>
                  {model.tier} Tier
                </Badge>
                <Badge variant="outline" className="text-xs bg-gray-800/50 border-gray-600/50 text-gray-300">
                  Max {model.max_images} image{model.max_images > 1 ? 's' : ''}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onGenerate}
                className="border-gray-600/50 text-gray-300 hover:bg-gray-700/50 hover:border-gray-500/50 transition-all duration-300"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate
              </Button>
              <Button
                variant="ghost"
                onClick={onClose}
                className="text-gray-400 hover:text-white border border-gray-600/50 hover:border-gray-500/50 transition-all duration-300"
              >
                ✕ Close
              </Button>
            </div>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Basic Info & Limits */}
            <div className="lg:col-span-1 space-y-6">
              {/* Description */}
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-2">Description</h3>
                <p className="text-gray-300 text-sm leading-relaxed">{model.description}</p>
              </div>

              {/* Model Limits */}
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Model Limits</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between py-2 border-b border-gray-700/50">
                    <span className="text-gray-400">Max Images per Request</span>
                    <Badge variant="secondary" className="text-xs">{model.max_images}</Badge>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-700/50">
                    <span className="text-gray-400">I2I Support</span>
                    <Badge variant={hasI2ISupport ? "default" : "secondary"} className="text-xs">
                      {hasI2ISupport ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-700/50">
                    <span className="text-gray-400">Processing Type</span>
                    <Badge variant="outline" className="text-xs">{model.processing_type}</Badge>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-400">Max Wait Time</span>
                    <Badge variant="outline" className="text-xs">{model.max_wait_time}</Badge>
                  </div>
                </div>
              </div>

              {/* Async Processing Info */}
              <InfoBox type="info" title="Async Processing">
                This model uses asynchronous processing. When a request is submitted the API returns a task_id. 
                The client must poll the task endpoint until the status becomes completed.
              </InfoBox>
            </div>

            {/* Middle Column - Capabilities & Sizes */}
            <div className="lg:col-span-1 space-y-6">
              {/* Capabilities */}
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Capabilities</h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(model.capabilities).map(([key, value]) => (
                    <Badge key={key} variant="outline" className="text-xs bg-gray-700/50 border-gray-600/50 text-gray-300">
                      {getCapabilityIcon(key)}
                      <span className="ml-1 capitalize">{key.replace('_', ' ')}</span>
                      <span className="ml-2 text-xs">{value ? '✅' : '❌'}</span>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Supported Sizes */}
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Supported Sizes</h3>
                <div className="flex flex-wrap gap-2">
                  {model.supported_sizes.map((size: string) => (
                    <Badge key={size} variant="secondary" className="text-xs bg-gray-700/50 border-gray-600/50 text-gray-300">
                      {size}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Provider Support */}
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Provider Support</h3>
                <div className="grid grid-cols-2 gap-2">
                  {model.providers.map((provider) => (
                    <Badge key={provider.provider_id} variant="default" className="text-xs bg-gray-700/50 border-gray-600/50 text-gray-300">
                      {getProviderIcon(provider.provider_name)}
                      <span className="ml-1 capitalize">{provider.provider_name}</span>
                      <span className="ml-2 text-xs">✅</span>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column - Pricing & Code Examples */}
            <div className="lg:col-span-1 space-y-6">
              {/* Pricing Information */}
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Pricing by Provider</h3>
                <div className="space-y-3">
                  {model.providers.map((provider) => (
                    <div key={provider.provider_id} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg border border-gray-600/50">
                      <div className="flex items-center gap-2">
                        {getProviderIcon(provider.provider_name)}
                        <span className="text-sm text-gray-300 capitalize">{provider.provider_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-3 w-3 text-green-400" />
                        <span className="text-green-400 font-bold text-sm">{provider.platform_price} credits</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-600/50 text-xs text-gray-400">
                  Starting at <span className="text-green-400 font-bold">{minPrice} credits</span> per image
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="mt-8 pt-6 border-t border-gray-700/50 flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Model ID: <span className="text-gray-300 font-mono">{model.model_id}</span>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="border-gray-600/50 text-gray-300 hover:bg-gray-700/50 hover:border-gray-500/50 transition-all duration-300"
              >
                Close Details
              </Button>
              <Button
                variant="default"
                onClick={onGenerate}
                className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground transition-all duration-300 shadow-glow hover:shadow-glow-lg"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate with {model.name}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}