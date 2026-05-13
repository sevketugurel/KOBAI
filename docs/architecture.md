# KOBİ Advisor — Mimari Kararlar

## Çok-Ajanlı Pipeline (LangGraph)

`agents/orchestrator.py` bir `StateGraph` ile zincirleme yürütür:

```
cashflow_node → risk_node → tax_node → kosgeb_node → approve_node → END
```

`AgentState` TypedDict (`Annotated[list[AgentStep], add]` reducer ile trace birikir). Her node mutasyon değil, partial-state dict döndürür — LangGraph state'i birleştirir.

`approve_node` insan-onayı (HITL) placeholder'ıdır. MVP'de `auto_approve=True` ile geçilir; üretimde frontend bir bekleyen job listesi gösterip onay isteyebilir.

## Model & Embedding Seçimi (CLAUDE.md uyumlu)

| Rol | Model | Sıcaklık | Sebep |
|---|---|---|---|
| Vision parse | `gemini-2.5-flash` | 0 | Deterministik fatura çıkarımı |
| Text üretim | `gemini-2.5-pro` | 0.3 | Mevzuat sentezi, chat yanıtı |
| Embedding | `gemini-embedding-2` | — | 1536d MRL, RETRIEVAL_DOCUMENT/QUERY ayrımı |

Yasaklı modeller: `gemini-1.5-*`, `text-embedding-004`, `gemini-2.0-flash`. `config.py` field_validator ile build-time engellenir.

## ChromaDB Kullanımı

**CLAUDE.md'den sapma:** Poliq projesinin Pass-1 oturum-başı in-memory ChromaDB kuralı KOBİ Advisor için geçerli değildir. Türk vergi mevzuatı korpusu uzun-ömürlü; her oturum başında yeniden embed etmek pratiksiz. Bu nedenle:

- `chromadb.HttpClient` ile docker-compose'taki `chromadb/chroma` servisine bağlanılır
- `kobi_mevzuat` koleksiyonu kalıcıdır (`IS_PERSISTENT=TRUE`)
- `scripts/seed_rag.py` ile bir kerelik seed'lenir

Koleksiyon adı `config.chroma_collection` üzerinden okunur — hardcode yok.

## NOT_MENTIONED Sentinel

`InvoiceData.vendor_tax_no` gibi opsiyonel alanlarda eksik veri için Gemini Vision prompt'u `"NOT_MENTIONED"` string'i döndürür. UI'da `bg-stone-100 text-stone-500` rozetiyle gösterilir. `None`, `""`, `"N/A"` kabul edilmez.

## Job Queue — In-Memory Tercihi

`services/job_queue.py` bir `dict[str, AnalysisResult]` ve `asyncio.Lock` kullanır. Tercih sebepleri:

- MVP tek replica çalıştığı için process-local state yeterli
- Redis eklemek docker-compose karmaşıklığını artırırdı
- SQLite kalıcılığı bu aşamada gerekli değil — restart'ta job'lar kaybolabilir

Üretim için bu modül Redis-backed bir kuyrukla swap edilir (interface zaten async).

`InvoiceStore` (aynı dosyada) upload→analyze arası invoice taşımak için kullanılır; aynı in-memory tasarım.

## Risk Eşikleri (Sabit, Kural Tabanlı)

| Sinyal | Eşik (Sarı) | Eşik (Kırmızı) |
|---|---|---|
| Gelir düşüşü | %20 | %40 |
| Gider artışı | %30 | %50 |
| Negatif net nakit | — | 2 ay üst üste |

Saf kurallar; ML modeline geçmeden önce açıklanabilirlik için tercih edildi. `agents/risk.py` her sinyal için Türkçe açıklama döndürür; UI bunu trafik ışığının altında gösterir.

## Test Stratejisi

- **Gemini & ChromaDB asla gerçek API çağrılmaz** — tüm testler stub'lar
- `@pytest.mark.integration` ile işaretli olası entegrasyon testleri varsayılan olarak atlanır (`addopts = "-m 'not integration'"`)
- Frontend: Vitest + RTL; `ResizeObserver` polyfill'i `src/test/setup.ts`'de
- React Dropzone'a multipart upload, `useChat`'in SSE stream'i, polling hook'u — hepsi davranış testli

## Bilinen Sınırlamalar / İleri Yol Haritası

1. SGK primi yaklaşımı sabit %22.5 üzerinden tahmin; gerçek brüt-net dönüşümü için sigortalı sayısı parametresi gerekli.
2. Gemini stream API kullanılmıyor — chat yanıtı tamamlanıp word-by-word chunk'lanıyor (tasarım gereği; `_stream_answer` tek noktada).
3. `human_approved` döngüsü self-loop; frontend'in approve butonu eklenince HITL aktifleşir.
4. Multi-tenant değil; oturum kavramı yok. v2'de Supabase Auth + RLS planlanıyor (aşağı bkz).

## v2 Yol Haritası — Multi-Tenant SaaS

Tam plan: `/Users/sevketugurel/.claude/plans/ara-t-rma-zeti-proje-hashed-meteor.md`. Fazlara bölünmüş yaklaşım; her faz bağımsız PR'a karşılık gelir.

### İzolasyon Modeli (karar)
- **Backend Supabase erişimi:** service-role client + middleware'de zorunlu `tenant_id` enjeksiyonu + repository katmanında explicit `tenant_id` filter. Postgres RLS yalnızca defense-in-depth katmanı (politika hatalı kodda son savunma).
- **ChromaDB izolasyonu:** Postgres RLS dışında. Per-tenant koleksiyon `tenant_{tenant_id}_docs` + paylaşılan `global_mevzuat`. Her sorgu iki koleksiyonu da çağırır, sonuçlar skor-birleştirilir.
- **Dosya depolama:** Supabase Storage bucket'larında `tenant-{tenant_id}/` prefix + bucket-level RLS.
- **Şifreleme:** Entegrasyon kimlik bilgileri Fernet (key `.env` → üretimde GCP Secret Manager).
- **Versiyonlama:** Mevcut `/upload`, `/analyze`, `/chat`, `/report` endpoint'leri `/v1` altında **dondurulur** (demo data); yeni özellikler `/v2/{slug}/...` altında. v1'e yeni özellik eklenmez.

### Faz Listesi
- **Faz 0** — Hazırlık: bu doküman + `.env.example` + multi-tenant test fixture iskeleti
- **Faz 1** — Multi-Tenant İskelet: Supabase auth, tenant CRUD, üyelik+rol, JWT middleware, repository katmanı (in-memory store → Supabase delegasyonu), audit log, frontend auth/slug routing
- **Faz 2** — Tenant-Aware AI: AgentState'e `tenant_id`, ChromaDB private+global koleksiyonlar, chat geçmişi persistansı (`session_id` ile `job_id`'den bağımsız)
- **Faz 3** — Banka Ekstresi Entegrasyonu: PDF upload → Gemini Vision parse → `bank_transactions`. (BDDK Open Banking v2'de yok — lisans gerektirir.)
- **Faz 4** — Vergi Takvimi: kayıt-anında 12 ay seed + Cloud Scheduler nightly hatırlatma
- **Faz 5** — e-Fatura (gelen, BYOI): tenant kendi Uyumsoft hesabı + nightly sync. e-Fatura **gönderme** ve e-Arşiv v3'e ertelendi.
- **Faz 6** — Sanal POS (online satış): iyzico Checkout webhook + Supabase Realtime. Fiziksel POS terminali v3.
- **Faz 7+** (kapsam dışı): Muhasebe yazılımı köprüsü, Open Banking, fiziksel POS, e-Fatura gönderme, abonelik & ödeme.

### Mühendislik Kuralları (tüm v2 fazlarında)
- Hiçbir endpoint `tenant_id`'yi query/body'den almaz — yalnızca middleware aracılığıyla `request.state`.
- Her yeni router için cross-tenant izolasyon testi zorunlu.
- v1 endpoint'leri kırılmaz; her faz sonunda mevcut testler + yeni testler yeşil olmalı.
- Frontend tasarım dili korunur (Inter + Plus Jakarta Sans, Lucide, mevcut paleti). Poliq'in tasarım kuralları (DM Serif Display, Phosphor) KOBAI'de **uygulanmaz**.
