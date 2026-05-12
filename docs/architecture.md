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
4. Multi-tenant değil; oturum kavramı yok. v2'de Supabase Auth + RLS planlanıyor.
