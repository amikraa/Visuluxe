-- Create models table
CREATE TABLE models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  model_id VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  tier VARCHAR(50) CHECK (tier IN ('Free', 'Pro', 'Enterprise')) DEFAULT 'Free',
  max_images INTEGER DEFAULT 1,
  supports_i2i BOOLEAN DEFAULT false,
  processing_type VARCHAR(50) CHECK (processing_type IN ('Async', 'Sync')) DEFAULT 'Async',
  max_wait_time VARCHAR(50) DEFAULT '5 min',
  capabilities JSONB DEFAULT '{}',
  supported_sizes JSONB DEFAULT '[]',
  status VARCHAR(50) CHECK (status IN ('active', 'maintenance', 'disabled')) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create model_providers table
CREATE TABLE model_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES models(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  provider_model_id VARCHAR(255) NOT NULL,
  provider_cost DECIMAL(10,2) NOT NULL,
  platform_price DECIMAL(10,2) NOT NULL,
  max_images_supported INTEGER DEFAULT 1,
  status VARCHAR(50) CHECK (status IN ('active', 'maintenance', 'disabled')) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(model_id, provider_id)
);

-- Create model_analytics table
CREATE TABLE model_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES models(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_generations INTEGER DEFAULT 0,
  total_revenue DECIMAL(10,2) DEFAULT 0,
  total_provider_cost DECIMAL(10,2) DEFAULT 0,
  profit DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(model_id, date)
);

-- Create indexes for performance
CREATE INDEX idx_models_status ON models(status);
CREATE INDEX idx_models_tier ON models(tier);
CREATE INDEX idx_model_providers_model_id ON model_providers(model_id);
CREATE INDEX idx_model_providers_provider_id ON model_providers(provider_id);
CREATE INDEX idx_model_providers_status ON model_providers(status);
CREATE INDEX idx_model_analytics_model_id ON model_analytics(model_id);
CREATE INDEX idx_model_analytics_date ON model_analytics(date);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_models_updated_at BEFORE UPDATE ON models FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_model_providers_updated_at BEFORE UPDATE ON model_providers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data
INSERT INTO models (name, model_id, description, tier, max_images, supports_i2i, capabilities, supported_sizes) VALUES
('Z-Image-Turbo', 'z-image-turbo', 'Lightning-fast image generation with optimized performance', 'Free', 1, false, '{"text_to_image": true, "image_to_image": false, "inpainting": false, "all_ratios": true, "multiple_images": false}', '["1024x1024", "1792x1024", "1024x1792"]'),
('Flux Dev', 'flux-dev', 'Advanced model with high-quality image generation', 'Pro', 4, true, '{"text_to_image": true, "image_to_image": true, "inpainting": true, "all_ratios": true, "multiple_images": true}', '["1024x1024", "1344x768", "768x1344", "1792x1024", "1024x1792"]'),
('Stable Diffusion XL', 'stable-diffusion-xl', 'High-resolution image generation with excellent detail', 'Free', 2, true, '{"text_to_image": true, "image_to_image": true, "inpainting": false, "all_ratios": true, "multiple_images": true}', '["1024x1024", "1344x768", "768x1344"]'),
('DALL-E 3', 'dall-e-3', 'OpenAI''s advanced text-to-image model', 'Pro', 1, false, '{"text_to_image": true, "image_to_image": false, "inpainting": false, "all_ratios": true, "multiple_images": false}', '["1024x1024", "1792x1024", "1024x1792"]'),
('Midjourney V6', 'midjourney-v6', 'Artistic style with unique creative flair', 'Pro', 3, true, '{"text_to_image": true, "image_to_image": true, "inpainting": true, "all_ratios": true, "multiple_images": true}', '["1024x1024", "1344x768", "768x1344", "1792x1024", "1024x1792"]'),
('SDXL Lightning', 'sdxl-lightning', 'Fast SDXL variant optimized for speed', 'Free', 1, false, '{"text_to_image": true, "image_to_image": false, "inpainting": false, "all_ratios": true, "multiple_images": false}', '["1024x1024"]');

-- Insert sample provider mappings (assuming providers table exists)
-- Note: This assumes providers already exist with IDs
INSERT INTO model_providers (model_id, provider_id, provider_model_id, provider_cost, platform_price, max_images_supported) 
SELECT 
  m.id,
  p.id,
  CASE 
    WHEN p.name = 'Flux' THEN m.model_id
    WHEN p.name = 'OpenAI' THEN 'dall-e-3'
    WHEN p.name = 'Stability AI' THEN 'stable-diffusion-xl'
    ELSE m.model_id
  END,
  CASE 
    WHEN p.name = 'Flux' THEN 8.00
    WHEN p.name = 'OpenAI' THEN 15.00
    WHEN p.name = 'Stability AI' THEN 12.00
    ELSE 10.00
  END,
  CASE 
    WHEN p.name = 'Flux' THEN 10.00
    WHEN p.name = 'OpenAI' THEN 20.00
    WHEN p.name = 'Stability AI' THEN 15.00
    ELSE 12.00
  END,
  m.max_images
FROM models m
CROSS JOIN providers p
WHERE p.status = 'active';