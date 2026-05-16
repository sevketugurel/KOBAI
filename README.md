# KOBİ Advisor — Türkiye KOBİ'leri için AI CFO

[![BTK Hackathon](https://img.shields.io/badge/BTK-Hackathon%2726-0066cc)](BTK-2026.pdf)
[![FastAPI](https://img.shields.io/badge/API-FastAPI-009688)](apps/api)
[![React](https://img.shields.io/badge/UI-React%2018-61dafb)](apps/web)

**KOBİ Advisor**, Türkiye'deki küçük ve orta ölçekli işletmeler için yapay zeka destekli finansal danışmanlık sunar: fatura PDF'lerini yapısal veriye dönüştürür, Türk vergi mevzuatını (GVK, KDV, SGK, VUK) RAG ile sorgular, nakit akışını tahmin eder, risk sinyalleri üretir ve kaynak atıflı önerilerle indirilebilir PDF raporu sunar.

> **Bağlam:** [BTK Hackathon'26 · Finans](BTK-2026.pdf) kapsamında 9–19 Mayıs 2026 arasında geliştirilmiştir. Jüri kriterleri: kullanıcı değeri, agentic yapılar, teknik mimari, UX ve çalışan demo. Büyük dil modeli olarak **Gemini** kullanımı hackathon şartıdır.

---

## İçindekiler

- [Problem ve çözüm](#problem-ve-çözüm)
- [Özellikler](#özellikler)
- [Mimari](#mimari)
- [Ajan pipeline'ı](#ajan-pipelineı)
- [Proje yapısı](#proje-yapısı)
- [Kurulum](#kurulum)
- [Demo senaryoları](#demo-senaryoları)
- [API özeti](#api-özeti)
- [v1 (MVP) ve v2 (multi-tenant)](#v1-mvp-ve-v2-multi-tenant)
- [Tech stack](#tech-stack)
- [Testler](#testler)
- [Dokümantasyon](#dokümantasyon)
- [Hackathon faz planı](#hackathon-faz-planı)
- [Bilinen sınırlamalar](#bilinen-sınırlamalar)
- [Ekip](#ekip)

---

## Problem ve çözüm

| | |
|---|---|
| **Problem** | Türkiye'de ~3,5 milyon KOBİ'nin büyük kısmı profesyonel mali müşavire düzenli erişemiyor. Nakit, vergi (KDV/SGK/gelir vergisi) ve teşvik takibi manuel veya reaktif kalıyor. |
| **Çözüm** | Fatura yükle → Gemini Vision ile ayrıştır → **LangGraph orchestrator** altında 4 özelleşmiş ajan → dashboard + Türkçe sohbet + PDF rapor. Öneriler mevzuat kaynağı ve güven skoru ile şeffaf. |
| **Demo hikâyesi** | **Ahmet Usta Fırını** — 6 aylık fatura seti, mevsimsel stok yüklemesi, KDV ödeme dönemleri ve risk uyarıları (v2'de **Kuzey Market** tenant'ı ile de sunulur). |

---

## Özellikler

- **PDF fatura ayrıştırma** — Gemini 2.5 Flash Vision; eksik alanlar için `NOT_MENTIONED` sentinel'i
- **Çok-ajanlı analiz** — Nakit akışı, risk, mevzuat RAG, KOSGEB uygunluk
- **RAG** — 17+ Türk mevzuat belgesi, ChromaDB kalıcı koleksiyon (`kobi_mevzuat`)
- **Dashboard** — KPI kartları, nakit akışı grafiği (Recharts), trafik ışığı risk, vergi önerileri, ajan trace paneli
- **Türkçe sohbet** — SSE stream; analiz bağlamına göre yanıt
- **PDF rapor** — ReportLab; human-in-the-loop onay kapısı (v2)
- **v2 SaaS iskeleti** — Supabase Auth, multi-tenant, banka ekstresi, vergi takvimi, sanal POS webhook

---

## Mimari

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Kullanıcı (tarayıcı)                             │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │ REST / SSE
┌─────────────────────────────────▼───────────────────────────────────────┐
│  apps/web — React 18 + TypeScript + Vite + Tailwind                      │
│  · v1: /  → upload → onboarding → /dashboard/:jobId                      │
│  · v2: /:slug/dashboard | integrations | tax-calendar | pos               │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────────┐
│  apps/api — FastAPI 0.115 + Pydantic v2                                  │
│  ┌──────────────┐  ┌─────────────────────────────────────────────────┐  │
│  │ /upload      │  │ LangGraph Orchestrator (agents/orchestrator.py)   │  │
│  │ /analyze     │  │  cashflow → risk → tax_rag → kosgeb → approve    │  │
│  │ /chat (SSE)  │  └───────────┬─────────────────────────────────────┘  │
│  │ /report      │              │                                         │
│  │ /v2/{slug}/* │              ▼                                         │
│  └──────────────┘  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌─────────┐ │
│                    │ Nakit    │ │ Risk     │ │ Mevzuat    │ │ KOSGEB  │ │
│                    │ Akışı    │ │ (kural)  │ │ RAG        │ │ (kural) │ │
│                    └──────────┘ └──────────┘ └─────┬──────┘ └─────────┘ │
└──────────────────────────────────────┬──────────────┼──────────────────────┘
                                       │              │
                    ┌──────────────────▼──┐    ┌──────▼──────┐
                    │ Gemini 2.5 Flash    │    │ ChromaDB    │
                    │ (Vision parse)      │    │ HTTP :8001  │
                    │ Gemini 2.5 Pro      │    │ kobi_mevzuat│
                    │ gemini-embedding-2  │    └─────────────┘
                    └─────────────────────┘
                    ┌─────────────────────┐
                    │ Supabase (v2)       │
                    │ Auth · Postgres RLS │
                    │ Storage · Realtime  │
                    └─────────────────────┘
```

Detaylı mimari kararlar: [`docs/architecture.md`](docs/architecture.md).

---

## Ajan pipeline'ı

Orchestrator sırası (`agents/orchestrator.py`):

```
cashflow_node → risk_node → tax_node → kosgeb_node → approve_node → END
```

| Ajan | Dosya | Sorumluluk | Çıktı |
|------|--------|------------|--------|
| **Nakit Akışı** | `nakit_akisi.py` | 3 dönem hareketli ortalama; KDV (çeyreklik) ve SGK (aylık) takvimi | 3 aylık nakit tahmini |
| **Risk** | `risk.py` | Eşik tabanlı: gelir↓ %20/%40, gider↑ %30/%50, 2 ay üst üste negatif nakit | `green` / `yellow` / `red` + Türkçe açıklama |
| **Mevzuat RAG** | `mevzuat_rag.py` | ChromaDB retrieval + Gemini 2.5 Pro sentez | Kaynak atıflı vergi önerileri (GVK/KDV md., güven 1–5) |
| **KOSGEB** | `kosgeb.py` | Sektör + şirket türü kural seti | Hibe/destek programı listesi |
| **Onay (HITL)** | `approve_node` | Rapor öncesi insan onayı | v2'de `POST .../approve`; v1'de `auto_approve=True` |

Her adım `AgentStep` log'u üretir; UI'da **Ajan ne yapıyor?** panelinde adım adım gösterilir.

---

## Proje yapısı

```
KOBAI/
├── apps/
│   ├── api/                 # FastAPI backend
│   │   ├── agents/          # LangGraph ajanları + orchestrator
│   │   ├── routers/         # v1: upload, analyze, chat, report
│   │   ├── routers/v2/      # Multi-tenant API
│   │   ├── rag/             # Embeddings, retriever, citations
│   │   ├── services/        # Gemini, job queue, PDF, tax calendar
│   │   ├── data/rag/        # Mevzuat metinleri (17+ dosya)
│   │   └── tests/           # pytest (150+ test)
│   └── web/                 # React + Vite frontend
│       └── src/
│           ├── pages/       # HomePage, DashboardPage, tenant sayfaları
│           ├── components/  # dashboard, chat, upload, onboarding
│           └── api/         # client.ts, v2.ts
├── data/demo/               # Ahmet Usta Fırını demo faturaları
├── docs/                    # architecture, api-contract, MVP rehberi
├── scripts/
│   ├── seed_rag.py          # ChromaDB mevzuat indeksleme
│   ├── generate_demo_data.py
│   └── e2e_demo.sh          # v2 uçtan uca doğrulama
├── supabase/migrations/     # v2 şema + demo seed
├── docker-compose.yml       # api + chromadb
└── .env.example
```

---

## Kurulum

### Ön koşullar

- Docker ve Docker Compose
- Node.js 20+
- Python 3.12+
- [Google AI Studio](https://aistudio.google.com/) — `GEMINI_API_KEY`

### 1. Ortam değişkenleri

```bash
cp .env.example .env
# GEMINI_API_KEY ve gerekirse Supabase anahtarlarını doldurun
```

### 2. Altyapı (API + ChromaDB)

```bash
docker compose up -d
# API: http://localhost:8000
# ChromaDB: http://localhost:8001
```

### 3. RAG indeksleme (bir kerelik)

```bash
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python ../../scripts/seed_rag.py
```

### 4. Frontend

```bash
cd apps/web
npm install
npm run dev
# http://localhost:5173
```

### 5. (İsteğe bağlı) Demo PDF üretimi

```bash
python scripts/generate_demo_data.py
# data/demo/ahmet_usta_firini/ altında 6 aylık fatura seti
```

---

## Demo senaryoları

### v1 — Ahmet Usta Fırını (auth gerekmez)

1. Ana sayfada fatura PDF'lerini sürükle-bırak yükleyin (veya demo verisi üretin).
2. Onboarding sihirbazı: **Şahıs Şirketi** → **Gıda & İçecek** → **Son 6 ay**.
3. Dashboard'da nakit akışı, risk trafiği, vergi önerileri (kaynak atıflı) ve KOSGEB önerilerini inceleyin.
4. Sohbet: *"Bu ay ne kadar KDV ödeyeceğim?"*
5. PDF raporu indirin.

**Beklenen içgörü:** Kasım ayı stok yüklemesinden kaynaklı nakit baskısı; risk panelinde sarı/kırmızı uyarı.

### v2 — Kuzey Market (Supabase + JWT)

Tenant akışı için Supabase migration'ları uygulayın ([`supabase/README.md`](supabase/README.md)).

```bash
# Örnek: JWT ile uçtan uca script
export KOBAI_JWT="<supabase-access-token>"
bash scripts/e2e_demo.sh
```

**Mock mod** (backend/Supabase olmadan UI):

```bash
cd apps/web
VITE_USE_MOCK=true npm run dev
# http://localhost:5173/kuzey-market/dashboard
```

---

## API özeti

Tam sözleşme: [`docs/api-contract.md`](docs/api-contract.md).

| Endpoint | Açıklama |
|----------|----------|
| `GET /health` | Sağlık + ChromaDB durumu |
| `POST /upload` | PDF fatura → `InvoiceData` |
| `POST /analyze` | Analiz job başlat (202 + `job_id`) |
| `GET /analyze/{job_id}` | Job durumu / tam `AnalysisResult` |
| `POST /chat` | Türkçe soru → SSE stream |
| `GET /report/{job_id}` | PDF rapor indir |
| `POST /v2/{slug}/analyze` | Tenant-scoped analiz (JWT) |
| `POST /v2/{slug}/chat` | Oturum bazlı sohbet |
| `POST /v2/{slug}/demo/load` | Önceden seed'lenmiş 24 fatura + analiz |

Hata gövdesi: `{ "detail": "Türkçe açıklama" }`.

---

## v1 (MVP) ve v2 (multi-tenant)

| | **v1** | **v2** |
|---|--------|--------|
| Kimlik | Yok (demo) | Supabase JWT + tenant slug |
| Veri | In-memory job store | Postgres + Storage |
| RAG | Yalnızca `kobi_mevzuat` | Tenant koleksiyonu + global mevzuat |
| Ek modüller | — | Banka ekstresi, vergi takvimi, iyzico POS webhook |
| API prefix | `/upload`, `/analyze`, … | `/v2/{slug}/...` |

v1 endpoint'leri **dondurulmuştur**; yeni özellikler v2 altında geliştirilir. Yol haritası: [`docs/architecture.md`](docs/architecture.md) (Faz 0–7).

---

## Tech stack

| Katman | Teknoloji |
|--------|-----------|
| Frontend | React 18, TypeScript 5, Vite 5, Tailwind 3, Recharts, Framer Motion, react-dropzone |
| Backend | FastAPI 0.115, Pydantic v2, LangGraph 0.2, ReportLab, tenacity |
| AI | Gemini 2.5 Flash (Vision), Gemini 2.5 Pro (metin), gemini-embedding-2 (1536d) |
| RAG | ChromaDB 0.5.20 (HTTP, kalıcı) |
| Auth / DB (v2) | Supabase (Auth, Postgres RLS, Storage) |
| Test | pytest + pytest-asyncio · Vitest + Testing Library |
| Infra | docker-compose (api + chromadb) |

### Model politikası

Yasaklı modeller (`config.py` ile build-time engellenir): `gemini-1.5-*`, `text-embedding-004`, `gemini-2.0-flash`.

---

## Testler

```bash
# Backend (~150+ test; Gemini/Chroma gerçek API çağrılmaz)
cd apps/api && source .venv/bin/activate && pytest -v

# Entegrasyon (canlı Gemini/Chroma — isteğe bağlı)
pytest -m integration

# Frontend
cd apps/web && npm test
```

---

## Dokümantasyon

| Belge | İçerik |
|-------|--------|
| [`docs/architecture.md`](docs/architecture.md) | LangGraph, ChromaDB, job queue, risk eşikleri, v2 izolasyon |
| [`docs/api-contract.md`](docs/api-contract.md) | v1 REST/SSE şemaları |
| [`docs/MVP-DEVELOPMENT-GUIDE.md`](docs/MVP-DEVELOPMENT-GUIDE.md) | Hackathon 7 faz planı, Go/No-Go, günlük rehber |
| [`docs/v2-design-plan.md`](docs/v2-design-plan.md) | v2 UI tasarım borcu ve bileşen planı |
| [`apps/api/data/rag/SOURCES.md`](apps/api/data/rag/SOURCES.md) | Mevzuat kaynak URL'leri |
| [`supabase/README.md`](supabase/README.md) | Migration ve tablo özeti |

---

## Hackathon faz planı

11 günlük geliştirme takvimi (özet):

| Faz | Tarih | Odak | Go/No-Go |
|-----|-------|------|----------|
| 0 | 9 May | Keşif, API sözleşmesi, RAG kaynakları — **kod yok** | Senaryo + şema kilitli |
| 1 | 10–11 May | Uçtan uca iskelet: PDF → analiz → ekran | 11 May 20:00 iskelet çalışıyor mu? |
| 2 | 12–13 May | LangGraph + 4 ajan | 13 May: ajanlar bağımsız test |
| 3 | 14–15 May | Dashboard, onboarding, gerçek veri | 15 May: dashboard canlı |
| 4 | 16 May | Entegrasyon: SSE, chat, PDF, HITL | 16 May: demo 3× kesintisiz |
| 5 | 17 May | Buffer: edge case, README, demo veri | Deploy'e hazır |
| 6 | 18–19 May | Deploy (Vercel/Railway), video, teslim | 18 May sabah: production demo |

**İlkeler:** Demo önce · İskelet ilk · Basit ve çalışan > karmaşık ve kırık · Buffer gün kutsal · Paralel izler API sözleşmesiyle senkronize.

---

## Bilinen sınırlamalar

1. SGK primi yaklaşık %22,5 sabit oranla tahmin edilir; gerçek brüt-net için sigortalı sayısı gerekir.
2. Chat yanıtı Gemini stream yerine tamamlanıp kelime kelime chunk'lanır.
3. v1 job store in-memory; API restart'ta job'lar kaybolur.
4. v2 tenant sayfalarının bir kısmı v1 dashboard kadar cilalı değil ([`docs/v2-design-plan.md`](docs/v2-design-plan.md)).

---

## Ekip

| İsim | Rol |
|------|-----|
| **Sevket Uğurel** | Full-stack + AI mimarisi |
| **Arkın İrem ER** | Full-stack |
| **Kerem Kundak** | — |

*(Git geçmişinden; rolleri güncellemek için PR açabilirsiniz.)*

---

## Lisans

Hackathon teslimi — lisans bilgisi ekip kararına bağlıdır.

---

<p align="center">
  <strong>Türkiye'nin ilk AI CFO'su</strong> — BTK Hackathon'26 · Finans
</p>
