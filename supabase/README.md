# Supabase — KOBAI v2

## Migration Uygulama

1. [supabase.com](https://supabase.com) → projen → **SQL Editor**
2. `migrations/001_mvp_schema.sql` içeriğini yapıştır → **Run**
3. Hata yoksa 5 tablo + RLS politikaları hazır

## .env Değerleri

Supabase dashboard → **Settings → API**:

```
SUPABASE_URL=https://<proje-id>.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # yalnızca backend
SUPABASE_JWT_SECRET=...            # Settings → API → JWT Settings
```

## Tablo Özeti (MVP)

| Tablo           | Açıklama                              |
|-----------------|---------------------------------------|
| `tenants`       | KOBİ kaydı + slug                     |
| `memberships`   | kullanıcı ↔ tenant + rol              |
| `documents`     | yüklenen/çekilen belgeler             |
| `analyses`      | LangGraph pipeline sonuçları          |
| `chat_messages` | AI sohbet geçmişi (session bazlı)     |

POS işlemleri, banka hareketleri, vergi takvimi → ileriki fazlar.

## Storage Bucket

SQL Editor'da ayrıca çalıştır:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-docs', 'tenant-docs', false);

CREATE POLICY "tenant_docs_access" ON storage.objects
  FOR ALL USING (
    bucket_id = 'tenant-docs'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM get_my_tenant_ids_text()
    )
  );
```
