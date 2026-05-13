-- KOBAI v2 — Faz 6: Sanal POS (iyzico Checkout)
-- Yeni tablo: pos_transactions
-- Provider config Faz 3'ten gelen `integrations` tablosunda
-- (`provider='iyzico_checkout'`); credentials Fernet ile şifreli.

CREATE TABLE pos_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pos_provider    TEXT NOT NULL DEFAULT 'iyzico_checkout',
  -- Sağlayıcının ödeme/işlem kimliği — global UNIQUE; idempotency için
  external_id     TEXT NOT NULL,
  amount          NUMERIC(14, 2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'TRY',
  txn_type        TEXT NOT NULL,             -- "sale" | "refund" | "void" | "preauth"
  status          TEXT NOT NULL,             -- "success" | "failed" | "pending" | "cancelled"
  payment_method  TEXT,                       -- "credit_card" | "debit_card" | "wallet" | "contactless"
  installments    INTEGER NOT NULL DEFAULT 1 CHECK (installments BETWEEN 1 AND 36),
  card_last_four  TEXT,                       -- "4242" gibi
  description     TEXT,
  raw_data        JSONB,
  transacted_at   TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pos_transactions
  ADD CONSTRAINT pos_txn_type_valid
  CHECK (txn_type IN ('sale', 'refund', 'void', 'preauth'));

ALTER TABLE pos_transactions
  ADD CONSTRAINT pos_status_valid
  CHECK (status IN ('success', 'failed', 'pending', 'cancelled'));

-- External id global UNIQUE: aynı iyzico payment_id ikinci kez gelirse dedupe.
-- (Webhook retry'larını absorbe etmek için tasarlandı.)
CREATE UNIQUE INDEX pos_transactions_external_unique
  ON pos_transactions (pos_provider, external_id);

CREATE INDEX idx_pos_tenant_date    ON pos_transactions (tenant_id, transacted_at DESC);
CREATE INDEX idx_pos_tenant_status  ON pos_transactions (tenant_id, status);

-- RLS
ALTER TABLE pos_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pos_transactions_tenant" ON pos_transactions
  FOR ALL USING (tenant_id IN (SELECT get_my_tenant_ids()));

-- Provider whitelist'ini Faz 3 migration'ında zaten tanımlandı; iyzico_checkout
-- ve craftgate listede mevcut. Yeni provider eklemek için ayrı migration gerekir.
