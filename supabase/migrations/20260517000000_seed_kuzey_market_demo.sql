-- KOBAI v2 demo seed — kuzey-market
--
-- Bu migration gerçek Supabase ortamında demo tenant ve ilişkili v2 verilerini
-- oluşturur. Kullanıcı üyeliği için claim_kuzey_market_demo() RPC fonksiyonu
-- auth.uid() değerini memberships tablosuna owner olarak ekler.

DO $$
DECLARE
  v_tenant_id UUID := '00000000-0000-0000-0000-000000000101';
BEGIN
  INSERT INTO tenants (id, slug, display_name, sector, company_type, tax_number, is_active)
  VALUES (
    v_tenant_id,
    'kuzey-market',
    'Kuzey Market',
    'gida_perakende',
    'ltd_sti',
    '3912345678',
    true
  )
  ON CONFLICT (slug) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    sector = EXCLUDED.sector,
    company_type = EXCLUDED.company_type,
    tax_number = EXCLUDED.tax_number,
    is_active = EXCLUDED.is_active;

  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'kuzey-market';

  INSERT INTO integrations (
    tenant_id, provider, is_active, credentials, config, last_sync_at, last_error
  )
  VALUES
    (
      v_tenant_id,
      'bank_statement',
      true,
      NULL,
      '{"bank_name":"Garanti BBVA","account_mask":"TR00 **** 0000"}'::jsonb,
      '2026-05-15T14:20:00+03:00',
      NULL
    ),
    (
      v_tenant_id,
      'iyzico_checkout',
      true,
      '{"encrypted":true,"demo":true}'::jsonb,
      '{"mode":"test","terminal_count":3}'::jsonb,
      '2026-05-16T08:45:00+03:00',
      NULL
    ),
    (
      v_tenant_id,
      'efatura_uyumsoft',
      false,
      NULL,
      '{"period":"2026-05"}'::jsonb,
      '2026-05-08T11:15:00+03:00',
      'Yetki yenilemesi gerekiyor'
    )
  ON CONFLICT (tenant_id, provider) DO UPDATE SET
    is_active = EXCLUDED.is_active,
    credentials = EXCLUDED.credentials,
    config = EXCLUDED.config,
    last_sync_at = EXCLUDED.last_sync_at,
    last_error = EXCLUDED.last_error;

  INSERT INTO bank_transactions (
    tenant_id, bank_name, account_iban, amount, currency, direction,
    description, reference_no, category, transacted_at, raw_parse
  )
  VALUES
    (v_tenant_id, 'garanti', 'TR000000000000000000000000', 98500.00, 'TRY', 'credit', 'Kurumsal müşteri tahsilatı', 'KM-REF-001', 'hizmet_satis', '2026-05-15T12:05:00+03:00', '{"seed":"kuzey-market"}'::jsonb),
    (v_tenant_id, 'garanti', 'TR000000000000000000000000', 18400.00, 'TRY', 'debit',  'Mayıs personel avansı',        'KM-REF-002', 'personel',     '2026-05-14T13:05:00+03:00', '{"seed":"kuzey-market"}'::jsonb),
    (v_tenant_id, 'garanti', 'TR000000000000000000000000', 12600.00, 'TRY', 'debit',  'Depo kira ödemesi',            'KM-REF-003', 'kira',         '2026-05-12T14:05:00+03:00', '{"seed":"kuzey-market"}'::jsonb),
    (v_tenant_id, 'garanti', 'TR000000000000000000000000', 56250.00, 'TRY', 'credit', 'E-ticaret toplu ödeme',        'KM-REF-004', 'mal_satis',    '2026-05-11T15:05:00+03:00', '{"seed":"kuzey-market"}'::jsonb),
    (v_tenant_id, 'garanti', 'TR000000000000000000000000', 8300.00,  'TRY', 'debit',  'SGK prim ödemesi',             'KM-REF-005', 'sgk',          '2026-05-09T16:05:00+03:00', '{"seed":"kuzey-market"}'::jsonb),
    (v_tenant_id, 'garanti', 'TR000000000000000000000000', 22450.00, 'TRY', 'debit',  'Tedarikçi mal alımı',          'KM-REF-006', 'hammadde',     '2026-05-06T17:05:00+03:00', '{"seed":"kuzey-market"}'::jsonb)
  ON CONFLICT DO NOTHING;

  INSERT INTO pos_transactions (
    tenant_id, pos_provider, external_id, amount, currency, txn_type, status,
    payment_method, installments, card_last_four, description, raw_data, transacted_at
  )
  VALUES
    (v_tenant_id, 'iyzico_checkout', 'kuzey-market-pos-001', 12450.00, 'TRY', 'sale',   'success', 'credit_card', 1, '4821', 'Web checkout satışı', '{"seed":"kuzey-market"}'::jsonb, '2026-05-16T09:20:00+03:00'),
    (v_tenant_id, 'iyzico_checkout', 'kuzey-market-pos-002', 8790.00,  'TRY', 'sale',   'success', 'credit_card', 3, '1934', 'Mağaza terminal satışı', '{"seed":"kuzey-market"}'::jsonb, '2026-05-16T10:20:00+03:00'),
    (v_tenant_id, 'iyzico_checkout', 'kuzey-market-pos-003', 2450.00,  'TRY', 'refund', 'success', 'credit_card', 3, '1934', 'Müşteri iadesi', '{"seed":"kuzey-market"}'::jsonb, '2026-05-16T11:20:00+03:00'),
    (v_tenant_id, 'iyzico_checkout', 'kuzey-market-pos-004', 18600.00, 'TRY', 'sale',   'success', 'debit_card',  1, '7742', 'Online satış', '{"seed":"kuzey-market"}'::jsonb, '2026-05-15T12:20:00+03:00'),
    (v_tenant_id, 'iyzico_checkout', 'kuzey-market-pos-005', 9200.00,  'TRY', 'sale',   'success', 'credit_card', 2, '5510', 'Mobil link satışı', '{"seed":"kuzey-market"}'::jsonb, '2026-05-14T13:20:00+03:00'),
    (v_tenant_id, 'iyzico_checkout', 'kuzey-market-pos-006', 4100.00,  'TRY', 'sale',   'pending', 'credit_card', 1, '6204', 'Bekleyen ödeme', '{"seed":"kuzey-market"}'::jsonb, '2026-05-13T14:20:00+03:00')
  ON CONFLICT (pos_provider, external_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    status = EXCLUDED.status,
    description = EXCLUDED.description,
    raw_data = EXCLUDED.raw_data,
    transacted_at = EXCLUDED.transacted_at;

  INSERT INTO tax_calendar_items (
    tenant_id, title, description, tax_type, due_date, amount, currency,
    status, period, notes, created_at, updated_at
  )
  SELECT v_tenant_id, x.title, x.description, x.tax_type, x.due_date::date,
         x.amount, 'TRY', x.status, x.period, x.notes, now(), now()
  FROM (
    VALUES
      ('Mayıs KDV Beyannamesi', 'Nisan dönemi KDV tahakkuku', 'kdv',          '2026-05-26', 28400.00, 'pending', '2026-04', 'POS satışları ve e-fatura kayıtlarıyla mutabakat bekliyor.'),
      ('SGK Prim Ödemesi',      'Nisan bordro primleri',      'sgk',          '2026-05-31', 18650.00, 'pending', '2026-04', NULL),
      ('Muhtasar Beyanname',    'Stopaj ve muhtasar bildirimi','muhtasar',    '2026-05-13', 9400.00,  'overdue', '2026-04', 'Gecikme cezası oluşmadan kapatılmalı.'),
      ('Geçici Vergi',          '1. dönem geçici vergi',      'gecici_vergi', '2026-05-10', 31200.00, 'paid',    '2026-Q1', 'Banka üzerinden ödendi.')
  ) AS x(title, description, tax_type, due_date, amount, status, period, notes)
  WHERE NOT EXISTS (
    SELECT 1
    FROM tax_calendar_items t
    WHERE t.tenant_id = v_tenant_id
      AND t.tax_type = x.tax_type
      AND COALESCE(t.period, t.due_date::text) = COALESCE(x.period, x.due_date)
  );
END $$;

CREATE OR REPLACE FUNCTION claim_kuzey_market_demo()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tenant_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is required';
  END IF;

  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'kuzey-market';
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'kuzey-market tenant is not seeded';
  END IF;

  INSERT INTO memberships (tenant_id, user_id, role)
  VALUES (v_tenant_id, v_user_id, 'owner')
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  RETURN v_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_kuzey_market_demo() TO authenticated;
