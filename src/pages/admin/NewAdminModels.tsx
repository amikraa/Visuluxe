import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Globe, 
  Zap, 
  Shield, 
  Code, 
  Clock, 
  DollarSign 
} from 'lucide-react';

interface Model {
  id: string;
  model_id: string;
  name: string;
  description: string;
  tier: string;
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

interface Provider {
  id: string;
  name: string;
  provider_type: string;
  status: string;
}

export default function NewAdminModels() {
  const [models, setModels] = useState<Model[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const { toast } = useToast();

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [modelsResponse, providersResponse] = await Promise.all([
          fetch('/api/admin/models'),
          fetch('/api/admin/providers')
        ]);

        if (modelsResponse.ok) {
          const modelsData = await modelsResponse.json();
          setModels(modelsData);
        }

        if (providersResponse.ok) {
          const providersData = await providersResponse.json();
          setProviders(providersData);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleToggleStatus = async (modelId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
      
      await fetch(`/api/admin/models/${modelId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus })
      });

      setModels(models.map(model => 
        model.id === modelId ? { ...model, status: newStatus } : model
      ));

      toast({
        title: 'Model Updated',
        description: `Model status changed to ${newStatus}`
      });
    } catch (error) {
      console.error('Error updating model:', error);
      toast({
        title: 'Error',
        description: 'Failed to update model status',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteModel = async (modelId: string, modelName: string) => {
    if (!confirm(`Are you sure you want to delete ${modelName}?`)) {
      return;
    }

    try {
      await fetch(`/api/admin/models/${modelId}`, {
        method: 'DELETE'
      });

      setModels(models.filter(model => model.id !== modelId));
      toast({
        title: 'Model Deleted',
        description: `${modelName} has been removed`
      });
    } catch (error) {
      console.error('Error deleting model:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete model',
        variant: 'destructive'
      });
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

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Free': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Pro': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const filteredModels = models.filter(model => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = model.name.toLowerCase().includes(searchLower) ||
                         model.model_id.toLowerCase().includes(searchLower) ||
                         model.description?.toLowerCase().includes(searchLower);
    
    const matchesStatus = statusFilter === 'all' || model.status === statusFilter;
    const matchesTier = tierFilter === 'all' || model.tier === tierFilter;
    
    return matchesSearch && matchesStatus && matchesTier;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-1">Model Registry</h2>
          <p className="text-gray-400 text-sm">Manage AI models, providers, and pricing dynamically</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => window.location.href = '/admin/models/create'}
            className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Model
          </Button>
          <Button
            onClick={() => window.location.href = '/admin/providers'}
            variant="outline"
            className="border-gray-600/50 text-gray-300 hover:bg-gray-700/50"
          >
            <Globe className="h-4 w-4 mr-2" />
            Manage Providers
          </Button>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="border-gray-600/50 text-gray-300 hover:bg-gray-700/50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-gray-800/50 border-gray-700/50">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search models..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-700/50 border-gray-600/50 text-white placeholder-gray-400"
                />
              </div>
            </div>
            <div>
              <Label className="text-gray-400 text-sm mb-2 block">Status</Label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            <div>
              <Label className="text-gray-400 text-sm mb-2 block">Tier</Label>
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Tiers</option>
                <option value="Free">Free</option>
                <option value="Pro">Pro</option>
                <option value="Enterprise">Enterprise</option>
              </select>
            </div>
            <div className="flex items-end">
              <div className="text-sm text-gray-400">
                Showing {filteredModels.length} of {models.length} models
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Models Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredModels.map((model) => (
          <Card key={model.id} className="bg-gray-800/50 border-gray-700/50 hover:border-gray-600/50 transition-all duration-300">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white text-lg">{model.name}</CardTitle>
                  <CardDescription className="text-gray-400 font-mono text-sm">{model.model_id}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`text-xs font-semibold ${getTierColor(model.tier)}`}>
                    {model.tier}
                  </Badge>
                  <Badge variant={model.status === 'active' ? "default" : "secondary"} className="text-xs">
                    {model.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Description */}
              <p className="text-gray-300 text-sm">{model.description}</p>

              {/* Providers */}
              <div>
                <Label className="text-gray-400 text-sm mb-2 block">Providers</Label>
                <div className="flex flex-wrap gap-2">
                  {model.providers.map((provider) => (
                    <Badge key={provider.provider_id} variant="outline" className="text-xs bg-gray-700/50 border-gray-600/50 text-gray-300">
                      {getProviderIcon(provider.provider_name)}
                      <span className="ml-1 capitalize">{provider.provider_name}</span>
                      <span className="ml-2 text-xs">• {provider.platform_price} credits</span>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Model Info */}
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  <span>Max: {model.max_images} images</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  <span>Wait: {model.max_wait_time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="h-3 w-3" />
                  <span>I2I: {model.supports_i2i ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  <span>Type: {model.processing_type}</span>
                </div>
              </div>

              {/* Sizes */}
              <div>
                <Label className="text-gray-400 text-sm mb-2 block">Supported Sizes</Label>
                <div className="flex flex-wrap gap-1">
                  {model.supported_sizes.map((size) => (
                    <Badge key={size} variant="secondary" className="text-xs bg-gray-700/50 border-gray-600/50 text-gray-300">
                      {size}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-700/50">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={model.status === 'active'}
                    onCheckedChange={() => handleToggleStatus(model.id, model.status)}
                  />
                  <span className="text-xs text-gray-400">Active</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.href = `/admin/models/${model.id}/edit`}
                    className="border-gray-600/50 text-gray-300 hover:bg-gray-700/50"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteModel(model.id, model.name)}
                    className="border-red-600/50 text-red-400 hover:bg-red-600/20 hover:text-red-300"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {filteredModels.length === 0 && (
          <div className="col-span-full text-center py-12">
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-8">
              <div className="text-gray-400 mb-4">
                <Search className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">No models found</h3>
              <p className="text-gray-400">
                Try adjusting your search criteria or filters to find models.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setTierFilter('all');
                }}
                className="mt-4 border-gray-600/50 text-gray-300 hover:bg-gray-700/50"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <Card className="bg-gray-800/50 border-gray-700/50">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{models.length}</div>
              <div className="text-sm text-gray-400">Total Models</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">
                {models.filter(m => m.status === 'active').length}
              </div>
              <div className="text-sm text-gray-400">Active Models</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">
                {models.filter(m => m.tier === 'Pro').length}
              </div>
              <div className="text-sm text-gray-400">Pro Models</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">
                {models.filter(m => m.supports_i2i).length}
              </div>
              <div className="text-sm text-gray-400">I2I Support</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}