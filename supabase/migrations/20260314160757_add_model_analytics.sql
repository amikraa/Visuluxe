CREATE TABLE IF NOT EXISTS model_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    total_generations INTEGER DEFAULT 0,
    total_revenue NUMERIC DEFAULT 0,
    total_provider_cost NUMERIC DEFAULT 0,
    profit NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(model_id, date)
);