-- KOBAI v2 — Faz 3: Banka Ekstresi + Entegrasyonlar
-- Yeni tablolar: integrations · bank_transactions
-- Mevcut tablolarla uyum: documents (bank_statement türü PDF burada saklanır)
--
-- Notlar:
--   • `integrations.credentials` Fernet (ENCRYPTION_KEY) ile şifreli JSONB tutar.
--     Service-role client bunu okur; tenant kullanıcılarına ASLA aynen dönmeyiz.
--     RLS direkt erişimi engeller (defense-in-depth).
--   • `bank_transactions.source_document_id` opsiyonel: API/CSV import'larında
--     null kalabilir; PDF import'unda her zaman dolu.

-- ─────────────────────────────────────────
-- 1. INTEGRATIONS  (üçüncü taraf bağlantı ayarları)
-- ─────────────────────────────────────────
CREATE TABLE integrations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT false,
  -- Fernet ciphertext + opsiyonel anahtar versiyonu. Asla istemciye dönmez.
  credentials   JSONB,
  -- Hassas olmayan ayarlar: sync penceresi, sütun eşleştirmeleri, vs.
  config        JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at  TIMESTAMPTZ,
  last_error    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);

-- Sağlayıcı whitelist'i — uygulama katmanı da kontrol eder, DB son savunma
ALTER TABLE integrations
  ADD CONSTRAINT integrations_provider_known
  CHECK (provider IN (
    'bank_statement',        -- Faz 3 (PDF parse, hiçbir 3rd-party bağlantı yok)
    'efatura_uyumsoft',      -- Faz 5 (BYOI)
    'efatura_mikro',         -- Faz 5
    'iyzico_checkout',       -- Faz 6 (sanal POS)
    'craftgate'              -- Faz 6
  ));

CREATE INDEX idx_integrations_tenant_id        ON integrations (tenant_id);
CREATE INDEX idx_integrations_tenant_provider  ON integrations (tenant_id, provider);

-- updated_at otomatik tetikleyici
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER integrations_set_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────
-- 2. BANK_TRANSACTIONS
-- ─────────────────────────────────────────
CREATE TABLE bank_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Ekstre PDF'i documents tablosunda; satır oradan parse edildiyse FK doldurulur.
  source_document_id  UUID REFERENCES documents(id) ON DELETE SET NULL,
  bank_name           TEXT NOT NULL,                       -- "is_bankasi" | "garanti" | "diger"
  account_iban        TEXT,                                -- TRxx... (UI'da maskelenir)
  amount              NUMERIC(14, 2) NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'TRY',
  -- "credit" = gelen para; "debit" = giden para
  direction           TEXT NOT NULL,
  description         TEXT,
  reference_no        TEXT,
  -- Faz 3 rule-based kategori. Manuel override için nullable.
  category            TEXT,
  transacted_at       TIMESTAMPTZ NOT NULL,
  -- Gemini Vision'ın ham parse çıktısı (debug + reprocess için)
  raw_parse           JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bank_transactions
  ADD CONSTRAINT bank_transactions_direction_valid
  CHECK (direction IN ('credit', 'debit'));

ALTER TABLE bank_transactions
  ADD CONSTRAINT bank_transactions_category_valid
  CHECK (category IS NULL OR category IN (
    'personel', 'kira', 'hammadde', 'vergi',
    'sgk', 'mal_satis', 'hizmet_satis', 'diger'
  ));

-- Aynı belgenin iki kez yüklenmesini engelle: (tenant, doc, ref + tutar + zaman)
-- reference_no null olabilir → COALESCE ile boş string'e indirgenir
CREATE UNIQUE INDEX bank_transactions_dedupe
  ON bank_transactions (
    tenant_id,
    COALESCE(source_document_id, '00000000-0000-0000-0000-000000000000'),
    transacted_at,
    amount,
    direction,
    COALESCE(reference_no, '')
  );

CREATE INDEX idx_bank_tx_tenant_date    ON bank_transactions (tenant_id, transacted_at DESC);
CREATE INDEX idx_bank_tx_tenant_cat     ON bank_transactions (tenant_id, category);
CREATE INDEX idx_bank_tx_source_doc     ON bank_transactions (source_document_id);

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────
ALTER TABLE integrations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integrations_tenant" ON integrations
  FOR ALL USING (tenant_id IN (SELECT get_my_tenant_ids()));

CREATE POLICY "bank_tx_tenant" ON bank_transactions
  FOR ALL USING (tenant_id IN (SELECT get_my_tenant_ids()));
