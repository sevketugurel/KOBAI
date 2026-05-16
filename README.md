# KOBİ Advisor — Türkiye KOBİ'leri için AI CFO

## Proje Açıklaması
Türkiye'deki 3,5 milyon KOBİ'nin %92'si profesyonel mali müşavire erişemiyor. KOBİ Advisor; fatura PDF'lerini analiz eden, Türk vergi mevzuatını (GVK/KDV/SGK) RAG ile sorgulayan, nakit akışını tahmin eden ve proaktif risk uyarısı veren çok-ajanlı bir AI CFO sistemidir.

## Problem & Çözüm
- **Problem:** Küçük işletmeler vergi planlaması, nakit yönetimi ve teşvik takibi için kaynak ayıramıyor.
- **Çözüm:** Fatura yükle → 4 AI ajanı (nakit akışı, risk, mevzuat RAG, KOSGEB) → kaynak atfı ile öneri → indirilebilir PDF raporu.

## Mimari

```
[ Kullanıcı ] -- PDF --> [ Vite/React UI ] -- REST --> [ FastAPI ]
                                                          |
                              +---------------------------+
                              | Gemini 2.5 Flash (Vision parse)
                              | LangGraph Orchestrator
                              |  ├── NakitAkışı  (3-dönem MA + KDV/SGK)
                              |  ├── Risk        (eşik tabanlı)
                              |  ├── MevzuatRAG ── ChromaDB(kobi_mevzuat)
                              |  ├── KOSGEB     (rule-based)
                              |  └── Rapor      (ReportLab PDF)
```

## Kurulum

**Ön koşullar:** Docker + docker-compose, Node 20+, Python 3.12+.

```bash
cp .env.example .env
# GEMINI_API_KEY değerini Google AI Studio'dan alıp doldurun

docker-compose up -d
# api (8000) + chromadb (8001) ayağa kalkar

cd apps/api && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python ../../scripts/seed_rag.py

cd ../web && npm install && npm run dev
# http://localhost:5173
```

## Demo Senaryo

```bash
python scripts/generate_demo_data.py
# data/demo/ahmet_usta_firini/ altında 6 aylık 24 fatura PDF'i + invoices.json üretilir
```

UI'da: Sürükle-bırak ile birkaç PDF yükleyin → Wizard'ı (Şahıs Şirketi, Gıda & İçecek, Son 6 ay) doldurun → Dashboard'da Kasım ayı stok yüklemesinden kaynaklı negatif nakit uyarısını ve trafik ışığı riskini görün.

### Tenant v2 Mock Demo

Tenant sayfalarını backend/Supabase bağlantısı olmadan deterministik veriyle açmak için web uygulamasını mock modda başlatın:

```bash
cd apps/web
VITE_USE_MOCK=true npm run dev
```

Örnek rotalar:

- `http://localhost:5173/kuzey-market/dashboard`
- `http://localhost:5173/kuzey-market/integrations`
- `http://localhost:5173/kuzey-market/tax-calendar`
- `http://localhost:5173/kuzey-market/pos`

`VITE_USE_MOCK` kapalıyken mevcut v2 API endpointleri ve Supabase oturumu kullanılmaya devam eder.

## Ajan Mimarisi

| Ajan | Sorumluluk | Çıktı |
|---|---|---|
| nakit_akisi | 3-dönem hareketli ortalama, KDV(çeyreklik)/SGK(her ay) takvimi | 3 aylık nakit tahmini |
| risk | Sabit eşikler: gelir↓ %20/%40, gider↑ %30/%50, 2 ay üst üste negatif = kırmızı | label + score + Türkçe açıklama |
| mevzuat_rag | ChromaDB similarity search + Gemini 2.5 Pro sentez | kaynak atıflı vergi önerileri |
| kosgeb | Sektör/şirket-tipi kural seti | hibe/destek önerileri |
| rapor | ReportLab Türkçe PDF | bytes (indirilebilir) |

Tüm ajanlar bir LangGraph state machine üzerinden zincirlenir: `cashflow → risk → tax_rag → kosgeb → human_approval → END`. Her adım `AgentStep` log'u üretir; UI'da "Ajan ne yapıyor?" panelinde adım adım gösterilir.

## Tech Stack

| Katman | Teknoloji |
|---|---|
| Frontend | React 18, TypeScript 5, Vite 5, Tailwind 3, Recharts, react-dropzone |
| Backend | FastAPI 0.115, Pydantic v2, LangGraph 0.2.38, ReportLab, tenacity |
| AI | Gemini 2.5 Flash (Vision), Gemini 2.5 Pro (Text), gemini-embedding-2 (1536d MRL) |
| RAG | ChromaDB 0.5.20 (HTTP, kalıcı koleksiyon) |
| Test | pytest + pytest-asyncio (backend), Vitest + RTL (frontend) |
| Infra | docker-compose (api + chromadb), python:3.12-slim image |

## Test Çalıştırma

```bash
# Backend (41 test)
cd apps/api && source .venv/bin/activate && pytest -v

# Frontend (12 test)
cd apps/web && npm test
```

## Ekip

- **Sevket Uğurel** — Full-stack + AI mimarisi
