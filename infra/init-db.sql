-- 4Runr Gateway Database Initialization
-- This script runs when the PostgreSQL container starts for the first time

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    visibility VARCHAR(20) NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
    manifest_version VARCHAR(20) NOT NULL DEFAULT '1.0',
    config_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Runs table (enhanced for agent execution)
CREATE TABLE IF NOT EXISTS runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id),
    workspace_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'stopped', 'failed', 'complete')),
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    cost_usd DECIMAL(10,6),
    sentinel_stats JSONB,
    idempotency_key VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_agents_workspace_id ON agents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agents_slug ON agents(slug);
CREATE INDEX IF NOT EXISTS idx_runs_agent_id ON runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at);
CREATE INDEX IF NOT EXISTS idx_runs_idempotency_key ON runs(idempotency_key);

-- Insert sample agents
INSERT INTO agents (id, workspace_id, name, slug, visibility, config_json) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'Demo Enricher', 'demo-enricher', 'public', '{"entry": "node apps/agents/enricher/index.js", "language": "js", "env_refs": ["OPENAI_API_KEY"], "policy_refs": ["default"], "resources": {"cpu": "0.5", "mem": "512Mi"}}'),
    ('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'Demo Scraper', 'demo-scraper', 'public', '{"entry": "python apps/agents/scraper/main.py", "language": "py", "env_refs": ["SCRAPER_API_KEY"], "policy_refs": ["default"], "resources": {"cpu": "0.3", "mem": "256Mi"}}')
ON CONFLICT DO NOTHING;
