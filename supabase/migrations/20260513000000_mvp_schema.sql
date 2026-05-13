-- KOBAI v2 MVP — Minimal multi-tenant şema
-- Tablolar: tenants · memberships · documents · analyses · chat_messages
-- POS / banka / vergi takvimi / audit → ileriki fazlar

-- ─────────────────────────────────────────
-- 1. TENANTS
-- ─────────────────────────────────────────
CREATE TABLE tenants (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT    UNIQUE NOT NULL,          -- "ahmet-usta-firini"
  display_name  TEXT    NOT NULL,
  sector        TEXT    NOT NULL,                 -- "gida_perakende" | "imalat" | ...
  company_type  TEXT    NOT NULL,                 -- "sahis_sirketi" | "ltd_sti" | "as"
  tax_number    TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- slug: küçük harf + rakam + tire, 3-50 karakter
ALTER TABLE tenants
  ADD CONSTRAINT tenants_slug_format
  CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$');

-- Rezerve slug'lar bloğu (uygulama katmanında da kontrol edilir)
CREATE UNIQUE INDEX tenants_slug_reserved
  ON tenants (slug)
  WHERE slug IN ('api','admin','app','www','static','health','demo');

-- ─────────────────────────────────────────
-- 2. MEMBERSHIPS  (kullanıcı ↔ tenant)
-- ─────────────────────────────────────────
CREATE TABLE memberships (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member',      -- "owner" | "admin" | "member" | "viewer"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

-- ─────────────────────────────────────────
-- 3. DOCUMENTS  (yüklenen / çekilen belgeler)
-- ─────────────────────────────────────────
CREATE TABLE documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  file_name   TEXT NOT NULL,
  file_url    TEXT NOT NULL,                      -- Supabase Storage path
  doc_type    TEXT NOT NULL DEFAULT 'invoice',    -- "invoice" | "receipt" | "bank_statement"
  source      TEXT NOT NULL DEFAULT 'manual',     -- "manual" | "e_fatura" | "pos"
  parsed_data JSONB,                              -- InvoiceData (Gemini Vision çıktısı)
  period      TEXT,                               -- "2025-06"
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────
-- 4. ANALYSES  (LangGraph pipeline sonuçları)
-- ─────────────────────────────────────────
CREATE TABLE analyses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id       TEXT UNIQUE NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',   -- "pending" | "running" | "completed" | "failed"
  period       TEXT,
  result       JSONB,                             -- AnalysisResult JSON
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ─────────────────────────────────────────
-- 5. CHAT_MESSAGES  (AI sohbet geçmişi)
-- ─────────────────────────────────────────
CREATE TABLE chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  role       TEXT NOT NULL,                       -- "user" | "assistant"
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────
-- İNDEKSLER  (RLS + sorgu performansı)
-- ─────────────────────────────────────────
CREATE INDEX idx_memberships_user_id     ON memberships (user_id);
CREATE INDEX idx_memberships_tenant_id   ON memberships (tenant_id);
CREATE INDEX idx_documents_tenant_period ON documents   (tenant_id, period);
CREATE INDEX idx_analyses_tenant_id      ON analyses    (tenant_id);
CREATE INDEX idx_analyses_job_id         ON analyses    (job_id);
CREATE INDEX idx_chat_session            ON chat_messages (tenant_id, session_id, created_at);

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────
ALTER TABLE tenants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships   ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Yardımcı fonksiyon: auth.uid() için tenant id listesi
-- SECURITY DEFINER → RLS döngüsünü kırar, her sorgu başına 1 kez çalışır
CREATE OR REPLACE FUNCTION get_my_tenant_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT tenant_id FROM memberships WHERE user_id = auth.uid();
$$;

-- tenants: üyesi olduğun tenant'ları görürsün
CREATE POLICY "tenants_member_select" ON tenants
  FOR SELECT USING (id IN (SELECT get_my_tenant_ids()));

-- memberships: kendi kayıtların
CREATE POLICY "memberships_own_select" ON memberships
  FOR SELECT USING (user_id = auth.uid());

-- documents, analyses, chat_messages: tenant izolasyonu
CREATE POLICY "documents_tenant"      ON documents      FOR ALL USING (tenant_id IN (SELECT get_my_tenant_ids()));
CREATE POLICY "analyses_tenant"       ON analyses       FOR ALL USING (tenant_id IN (SELECT get_my_tenant_ids()));
CREATE POLICY "chat_messages_tenant"  ON chat_messages  FOR ALL USING (tenant_id IN (SELECT get_my_tenant_ids()));

-- ─────────────────────────────────────────
-- DEMO TENANT  (auth gerektirmeyen önizleme)
-- ─────────────────────────────────────────
INSERT INTO tenants (id, slug, display_name, sector, company_type)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'demo',
  'Demo İşletme',
  'gida_perakende',
  'sahis_sirketi'
);
