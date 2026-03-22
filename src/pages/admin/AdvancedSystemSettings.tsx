import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Save, Trash2, CheckCircle, XCircle, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';

interface Setting {
  key: string;
  value: any;
  description?: string;
  category: string;
  type: 'string' | 'number' | 'boolean' | 'list' | 'json';
}

interface CategorySettings {
  [key: string]: Setting;
}

const CATEGORIES = [
  { id: 'job_processing', name: 'Job Processing', color: 'bg-blue-500' },
  { id: 'provider_health', name: 'Provider Health', color: 'bg-green-500' },
  { id: 'storage', name: 'Storage', color: 'bg-purple-500' },
  { id: 'notifications', name: 'Notifications', color: 'bg-orange-500' },
  { id: 'security', name: 'Security', color: 'bg-red-500' },
  { id: 'system', name: 'System', color: 'bg-gray-500' },
];

const SystemSettings: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<CategorySettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState('job_processing');
  const [searchTerm, setSearchTerm] = useState('');
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/admin/system-settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      
      const data = await response.json();
      
      const settingsMap: CategorySettings = {};
      Object.entries(data.settings).forEach(([key, value]) => {
        settingsMap[key] = {
          key: key,
          value: value,
          description: '',
          category: 'system',
          type: 'string',
        };
      });

      setSettings(settingsMap);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: "Error",
        description: "Failed to fetch system settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: { ...prev[key], value }
    }));
  };

  const handleSave = async (key: string) => {
    try {
      setSaving(true);
      const setting = settings[key];
      
      const response = await fetch(`/api/v1/admin/system-settings/${key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          value: setting.value,
          description: setting.description,
          updated_by: user?.email || 'admin'
        })
      });

      if (!response.ok) throw new Error('Failed to update setting');

      toast({
        title: "Success",
        description: `Setting ${key} updated successfully`,
      });
    } catch (error) {
      console.error('Error saving setting:', error);
      toast({
        title: "Error",
        description: "Failed to update setting",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkSave = async () => {
    try {
      setSaving(true);
      const updates = Object.values(settings).reduce((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {} as Record<string, any>);

      const response = await fetch('/api/v1/admin/system-settings/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) throw new Error('Failed to update settings');

      toast({
        title: "Success",
        description: "All settings updated successfully",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = async () => {
    try {
      setSaving(true);
      // This would need to be implemented based on your default values
      toast({
        title: "Info",
        description: "Reset to defaults functionality would be implemented here",
      });
    } catch (error) {
      console.error('Error resetting settings:', error);
      toast({
        title: "Error",
        description: "Failed to reset settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const validateSetting = (key: string, value: any): string | null => {
    const setting = settings[key];
    if (!setting) return null;

    try {
      switch (setting.type) {
        case 'number':
          if (isNaN(Number(value))) return 'Must be a valid number';
          break;
        case 'boolean':
          if (typeof value !== 'boolean') return 'Must be true or false';
          break;
        case 'list':
          if (!Array.isArray(value)) return 'Must be an array';
          break;
        case 'json':
          if (typeof value !== 'object') return 'Must be a valid JSON object';
          break;
      }
      return null;
    } catch (error) {
      return 'Invalid value format';
    }
  };

  const renderSettingInput = (setting: Setting) => {
    const error = validateSetting(setting.key, setting.value);
    if (error) setValidationErrors(prev => ({ ...prev, [setting.key]: error }));
    else setValidationErrors(prev => ({ ...prev, [setting.key]: '' }));

    switch (setting.type) {
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              checked={setting.value === true || setting.value === 'true'}
              onCheckedChange={(checked) => handleValueChange(setting.key, checked)}
            />
            <span className="text-sm text-muted-foreground">
              {setting.value === true || setting.value === 'true' ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        );
      
      case 'number':
        return (
          <Input
            type="number"
            value={setting.value || ''}
            onChange={(e) => handleValueChange(setting.key, Number(e.target.value))}
            className={validationErrors[setting.key] ? 'border-red-500' : ''}
          />
        );
      
      case 'list':
        return (
          <Textarea
            value={Array.isArray(setting.value) ? setting.value.join(', ') : setting.value || ''}
            onChange={(e) => handleValueChange(setting.key, e.target.value.split(',').map(s => s.trim()))}
            placeholder="Enter comma-separated values"
            className={validationErrors[setting.key] ? 'border-red-500' : ''}
          />
        );
      
      case 'json':
        return (
          <Textarea
            value={typeof setting.value === 'object' ? JSON.stringify(setting.value, null, 2) : setting.value || ''}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleValueChange(setting.key, parsed);
              } catch {
                handleValueChange(setting.key, e.target.value);
              }
            }}
            placeholder="Enter JSON object"
            className={validationErrors[setting.key] ? 'border-red-500' : ''}
          />
        );
      
      default:
        return (
          <Input
            value={setting.value || ''}
            onChange={(e) => handleValueChange(setting.key, e.target.value)}
            className={validationErrors[setting.key] ? 'border-red-500' : ''}
          />
        );
    }
  };

  const filteredSettings = Object.values(settings).filter(setting =>
    setting.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
    setting.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    setting.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const settingsByCategory = filteredSettings.reduce((acc, setting) => {
    if (!acc[setting.category]) acc[setting.category] = [];
    acc[setting.category].push(setting);
    return acc;
  }, {} as { [key: string]: Setting[] });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">System Settings</h1>
          <p className="text-muted-foreground">Manage system configuration and operational parameters</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={fetchSettings} disabled={saving}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleBulkSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            Save All
          </Button>
          <Button variant="destructive" onClick={handleResetToDefaults} disabled={saving}>
            <Trash2 className="h-4 w-4 mr-2" />
            Reset Defaults
          </Button>
        </div>
      </div>

      <div className="flex space-x-4 items-center">
        <Input
          placeholder="Search settings..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <div className="text-sm text-muted-foreground">
          {Object.values(settings).length} total settings
        </div>
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="grid grid-cols-6 gap-2">
          {CATEGORIES.map(category => (
            <TabsTrigger key={category.id} value={category.id}>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${category.color}`}></div>
                <span>{category.name}</span>
              </div>
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIES.map(category => (
          <TabsContent key={category.id} value={category.id}>
            <div className="grid gap-6">
              {settingsByCategory[category.id]?.map(setting => (
                <Card key={setting.key}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{setting.key}</CardTitle>
                        <CardDescription>{setting.description}</CardDescription>
                      </div>
                      <div className="flex space-x-2">
                        <Badge variant="secondary">{setting.type}</Badge>
                        <Badge className={category.color}>{category.name}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2">
                      <Label>Value</Label>
                      {renderSettingInput(setting)}
                      {validationErrors[setting.key] && (
                        <p className="text-red-500 text-sm">{validationErrors[setting.key]}</p>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-muted-foreground">
                        Type: {setting.type} | Category: {category.name}
                      </div>
                      <Button 
                        onClick={() => handleSave(setting.key)}
                        disabled={saving || !!validationErrors[setting.key]}
                        className="flex items-center space-x-2"
                      >
                        <Save className="h-4 w-4" />
                        <span>Save</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {(!settingsByCategory[category.id] || settingsByCategory[category.id].length === 0) && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No settings found for this category
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default SystemSettings;