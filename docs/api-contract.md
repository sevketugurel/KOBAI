# KOBİ Advisor API Contract

Faz 0 mutabakat belgesi — Backend ve Frontend arası tip sözleşmesi.

Base URL: `http://localhost:8000` (dev), production: deploy hedefine bağlı.

## GET /health

Sağlık kontrolü.

**Response 200:**
```json
{ "status": "ok", "version": "0.1.0" }
```

## POST /upload

Bir fatura PDF'i yükle, Gemini Vision ile ayrıştır.

**Request:** `multipart/form-data`, alan `file` (`application/pdf`, ≤10 MB).

**Response 200:**
```json
{
  "invoice_id": "9f3a8b21-...",
  "data": {
    "invoice_id": "9f3a8b21-...",
    "vendor_name": "Un Tedarikçisi A.Ş.",
    "vendor_tax_no": "9876543210",
    "date": "2026-01-15",
    "due_date": null,
    "items": [
      { "description": "Un alımı", "quantity": 1, "unit_price": 20833.33,
        "total": 20833.33, "kdv_rate": 20 }
    ],
    "subtotal": 20833.33,
    "kdv_amount": 4166.67,
    "total_amount": 25000.00,
    "currency": "TRY",
    "category": "gider",
    "raw_text": null
  }
}
```

**Hata yanıtları:**
- 400 — Yalnızca PDF kabul edilir
- 413 — Dosya 10 MB sınırını aşıyor
- 422 — Fatura ayrıştırılamadı

Eksik alanlar yerine `"NOT_MENTIONED"` sentinel'i veya `null` dönülebilir; backend bunu graceful degradation ile geçer.

## POST /analyze

Analizi arka planda başlatır. Hemen dönen `job_id` ile durum sorgulanır.

**Request:**
```json
{
  "invoice_ids": ["9f3a8b21-...", "..."],
  "company_type": "Şahıs Şirketi",
  "sector": "Gıda & İçecek",
  "period": "6m"
}
```

**Response 202:**
```json
{ "job_id": "j-7c9f...", "status": "pending" }
```

## GET /analyze/{job_id}

Job durumu ve tamamlandıysa tam AnalysisResult.

**Response 200 (processing):**
```json
{ "job_id": "j-7c9f...", "status": "processing", "invoices": [], ... }
```

**Response 200 (completed) — özet:**
```json
{
  "job_id": "j-7c9f...",
  "status": "completed",
  "invoices": [ /* InvoiceData[] */ ],
  "cash_flow_forecast": [
    { "month": "2026-04", "income": 47000, "expense": 33000, "net": 14000,
      "kdv_payment": 0, "sgk_payment": 742.5, "cumulative": 14000 },
    { "month": "2026-05", "income": 47000, "expense": 33000, "net": 14000,
      "kdv_payment": 0, "sgk_payment": 742.5, "cumulative": 28000 },
    { "month": "2026-06", "income": 47000, "expense": 33000, "net": 11000,
      "kdv_payment": 2333, "sgk_payment": 742.5, "cumulative": 39000 }
  ],
  "risk_score": 3,
  "risk_label": "yellow",
  "risk_explanation": "Dikkat edilmesi gereken sinyaller: Gider %40 arttı.",
  "tax_recommendations": [
    { "recommendation": "KDV beyannamesini ayın 26'sına kadar verin.",
      "source": "KDV", "article": "KDV Md. 41", "confidence": 4.2, "action": "review" }
  ],
  "kosgeb_suggestions": [
    { "title": "KOSGEB KOBİGEL — Gıda İmalatı Destek Programı",
      "detail": "Gıda işletmeleri için makine modernizasyonu desteği.",
      "url": "https://www.kosgeb.gov.tr" }
  ],
  "agent_trace": [
    { "agent_name": "nakit_akisi", "action": "forecast 3ay", "input": {},
      "output": { "summary": "3 ay" }, "duration_ms": 12, "confidence": 4.0 }
  ],
  "created_at": "2026-05-12T08:00:00",
  "completed_at": "2026-05-12T08:00:04",
  "error": null
}
```

**404** — job bulunamadı.

## POST /chat (SSE)

Türkçe doğal dil sorgusu; SSE stream ile yanıt.

**Request:**
```json
{
  "message": "Bu ay ne kadar KDV ödeyeceğim?",
  "job_id": "j-7c9f...",
  "history": [
    { "role": "user", "content": "Önceki mesaj" },
    { "role": "assistant", "content": "Önceki yanıt" }
  ]
}
```

**Response:** `text/event-stream`. Her chunk:
```
data: Tahmini
data: KDV
data: ödemeniz
...
data: [DONE]
```

**404** — job yok.

## GET /report/{job_id}

PDF raporu indir.

**Response 200:** `application/pdf` binary, `Content-Disposition: attachment; filename="rapor-{job_id}.pdf"`.

**409** — job henüz tamamlanmadı.
**404** — job yok.

## Error Shape

Tüm hatalar FastAPI'nin default'u:
```json
{ "detail": "Türkçe açıklama" }
```
