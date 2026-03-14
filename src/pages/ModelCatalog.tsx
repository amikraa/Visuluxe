import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Sparkles, Filter, Code, Globe, Zap, Shield, Clock, DollarSign, Eye, EyeOff, Settings } from 'lucide-react';
import { ModelCard } from '@/components/ModelCard';
import { ModelModal } from '@/components/ModelModal';
import { CodeBlock } from '@/components/CodeBlock';
import { InfoBox } from '@/components/InfoBox';

interface Model {
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
  created_at: string;
  updated_at: string;
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
}

interface ModelProvider {
  id: string;
  provider_id: string;
  provider_name: string;
  provider_model_id: string;
  provider_cost: number;
  platform_price: number;
  max_images_supported: number;
  status: string;
}

export default function ModelCatalog() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch models from API
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch('/api/models');
        const data = await response.json();
        setModels(data);
      } catch (error) {
        console.error('Failed to fetch models:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchModels();
  }, []);

  const filteredModels = models.filter(model => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = model.name.toLowerCase().includes(searchLower) ||
                         model.model_id.toLowerCase().includes(searchLower) ||
                         model.description.toLowerCase().includes(searchLower);
    
    const matchesSize = sizeFilter === 'all' || model.supported_sizes.includes(sizeFilter);
    const matchesProvider = providerFilter === 'all' || model.providers.some(p => p.provider_name.toLowerCase() === providerFilter);
    
    return matchesSearch && matchesSize && matchesProvider;
  });

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'flux': return <Zap className="h-4 w-4" />;
      case 'openai': return <Globe className="h-4 w-4" />;
      case 'stability': return <Shield className="h-4 w-4" />;
      default: return <Code className="h-4 w-4" />;
    }
  };

  const handleGenerate = (model: Model) => {
    // Navigate to generation page with this model pre-selected
    window.location.href = `/generate?model=${model.model_id}`;
  };

  const handleModelClick = (model: Model) => {
    setSelectedModel(model);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedModel(null);
  };

  // Get unique sizes from all models
  const allSizes = Array.from(new Set(models.flatMap(model => model.supported_sizes))).sort();
  
  // Get providers from pricing keys
  const providers = ['flux', 'openai', 'stability'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header Section */}
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Model Catalog</h1>
          <p className="text-gray-400 text-lg">Explore available AI models and their capabilities</p>
          <div className="flex items-center justify-center gap-4 mt-4 text-sm text-gray-400">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              {models.length} Models Available
            </span>
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" />
              Async Processing
            </span>
            <span className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-400" />
              Pay-per-Use
            </span>
          </div>
        </div>

        {/* Filters Section */}
        <Card className="bg-gray-800/50 border-gray-700/50 mb-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search models by name, ID, or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-gray-700/50 border-gray-600/50 text-white placeholder-gray-400"
                  />
                </div>
              </div>
              
              {/* Size Filter */}
              <div>
                <Label className="text-gray-400 text-sm mb-2 block">Filter by Size</Label>
                <select
                  value={sizeFilter}
                  onChange={(e) => setSizeFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="all">All Sizes</option>
                  {allSizes.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
              
              {/* Provider Filter */}
              <div>
                <Label className="text-gray-400 text-sm mb-2 block">Filter by Provider</Label>
                <select
                  value={providerFilter}
                  onChange={(e) => setProviderFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="all">All Providers</option>
                  {providers.map((provider) => (
                    <option key={provider} value={provider}>
                      <span className="flex items-center gap-2">
                        {getProviderIcon(provider)}
                        {provider.charAt(0).toUpperCase() + provider.slice(1)}
                      </span>
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Filter Summary */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700/50">
              <div className="text-sm text-gray-400">
                Showing {filteredModels.length} of {models.length} models
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Filter className="h-4 w-4" />
                {searchTerm && <span>Search: "{searchTerm}"</span>}
                {sizeFilter !== 'all' && <span>Size: {sizeFilter}</span>}
                {providerFilter !== 'all' && <span>Provider: {providerFilter}</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Models Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredModels.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-8">
                <div className="text-gray-400 mb-4">
                  <Search className="h-12 w-12 mx-auto" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No models found</h3>
                <p className="text-gray-400">
                  Try adjusting your search criteria or filters to find the model you're looking for.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setSizeFilter('all');
                    setProviderFilter('all');
                  }}
                  className="mt-4 border-gray-600/50 text-gray-300 hover:bg-gray-700/50 hover:border-gray-500/50 transition-all duration-300"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          ) : (
            filteredModels.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                onClick={() => handleModelClick(model)}
                onGenerate={() => handleGenerate(model)}
              />
            ))
          )}
        </div>

        {/* Quick Start Guide */}
        <Card className="bg-gray-800/50 border-gray-700/50 mt-12">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Quick Start Guide</h3>
                <InfoBox type="tip" title="Getting Started">
                  <div className="space-y-2">
                    <p>1. Browse the models above to find the one that fits your needs</p>
                    <p>2. Click "View Details" to see full specifications and pricing</p>
                    <p>3. Use "Generate" to start creating images with your selected model</p>
                    <p>4. Monitor your credits and usage in your dashboard</p>
                  </div>
                </InfoBox>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">API Integration</h3>
                <CodeBlock
                  title="Basic API Request"
                  code={`curl -X POST https://api.visuluxe.com/v1/images/generations \\
-H "Authorization: Bearer YOUR_API_KEY" \\
-H "Content-Type: application/json" \\
-d '{
  "model": "z-image-turbo",
  "prompt": "A beautiful landscape with mountains",
  "size": "1024x1024",
  "response_format": "url"
}'`}
                  language="bash"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Model Details Modal */}
      {selectedModel && (
        <ModelModal
          model={selectedModel}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onGenerate={() => handleGenerate(selectedModel)}
        />
      )}
    </div>
  );
}