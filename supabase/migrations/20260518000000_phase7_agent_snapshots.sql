-- KOBAI v2 — Faz 7: Event-driven ajan orkestrasyonu
-- Yeni tablo: tenant_agent_snapshots
-- Her ajan için tenant başına tek satır (UNIQUE). Veri eventleri tetikledikçe
-- snapshot upsert edilir. analyze endpoint'i bu snapshot'ları okur.

CREATE TABLE tenant_agent_snapshots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_name          TEXT NOT NULL,
  status              TEXT NOT NULL,
  input_version_hash  TEXT,
  output              JSONB,
  trace               JSONB,
  missing             JSONB,
  error               TEXT,
  last_event          TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tenant_agent_snapshots
  ADD CONSTRAINT agent_snapshot_agent_valid
  CHECK (agent_name IN ('nakit_akisi', 'risk', 'mevzuat_rag', 'kosgeb'));

ALTER TABLE tenant_agent_snapshots
  ADD CONSTRAINT agent_snapshot_status_valid
  CHECK (status IN ('idle', 'pending', 'running', 'completed', 'failed', 'stale'));

CREATE UNIQUE INDEX tenant_agent_snapshots_unique
  ON tenant_agent_snapshots (tenant_id, agent_name);

CREATE INDEX idx_agent_snapshots_tenant
  ON tenant_agent_snapshots (tenant_id, updated_at DESC);

-- RLS — tenant izolasyonu (defense-in-depth; repo da tenant_id ile filtreliyor)
ALTER TABLE tenant_agent_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_snapshots_tenant" ON tenant_agent_snapshots
  FOR ALL USING (tenant_id IN (SELECT get_my_tenant_ids()));
