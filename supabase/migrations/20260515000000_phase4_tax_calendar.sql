-- KOBAI v2 — Faz 4: Vergi Takvimi
-- Yeni tablo: tax_calendar_items
-- Tenant kayıt anında 12 ay ileriye doğru otomatik seed (app katmanı).
-- Cron (Cloud Scheduler) günlük çalışıp `pending → overdue` geçişini yapar
-- ve yaklaşan kalemler için audit kaydı atar.

-- ─────────────────────────────────────────
-- TAX_CALENDAR_ITEMS
-- ─────────────────────────────────────────
CREATE TABLE tax_calendar_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,                   -- "Mart 2026 KDV Beyanı"
  description  TEXT,
  tax_type     TEXT NOT NULL,                   -- "kdv" | "muhtasar" | "gecici_vergi" | "sgk" | "gelir_vergisi" | "kurumlar_vergisi"
  due_date     DATE NOT NULL,
  -- Beyan henüz hesaplanmamışsa null; hesaplanınca app güncelleyebilir.
  amount       NUMERIC(14, 2),
  currency     TEXT NOT NULL DEFAULT 'TRY',
  status       TEXT NOT NULL DEFAULT 'pending', -- "pending" | "paid" | "overdue"
  -- "2026-03" gibi periyod etiketi (hangi aya/dönem için)
  period       TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tax_calendar_items
  ADD CONSTRAINT tax_calendar_tax_type_valid
  CHECK (tax_type IN (
    'kdv', 'muhtasar', 'gecici_vergi', 'sgk',
    'gelir_vergisi', 'kurumlar_vergisi'
  ));

ALTER TABLE tax_calendar_items
  ADD CONSTRAINT tax_calendar_status_valid
  CHECK (status IN ('pending', 'paid', 'overdue'));

-- Aynı tenant'ta aynı vergi türü + dönem tekrar oluşmasın
CREATE UNIQUE INDEX tax_calendar_period_unique
  ON tax_calendar_items (
    tenant_id, tax_type, COALESCE(period, due_date::text)
  );

CREATE INDEX idx_tax_calendar_tenant_due
  ON tax_calendar_items (tenant_id, due_date);

CREATE INDEX idx_tax_calendar_tenant_status
  ON tax_calendar_items (tenant_id, status);

-- set_updated_at trigger 002 migration'da tanımlandı; aynı fonksiyonu kullan
-- (her iki migration da merge edilmemiş olabilir → idempotent CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tax_calendar_set_updated_at
  BEFORE UPDATE ON tax_calendar_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────
ALTER TABLE tax_calendar_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tax_calendar_tenant" ON tax_calendar_items
  FOR ALL USING (tenant_id IN (SELECT get_my_tenant_ids()));
