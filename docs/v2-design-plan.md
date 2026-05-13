# KOBAI v2 — UI Tasarım Planı

## Bağlam

v2 multi-tenant fazlarını (1-6) hızla iskelet seviyesinde tamamladık.
Backend tarafı production-kalite (158 test yeşil), ancak frontend
sayfalar `IntegrationsPage`, `TaxCalendarPage`, `EFaturaPage`, `POSPage`
ve `TenantDashboardStub` form-tarzı minimal layout'la yazıldı; v1
dashboard'unda yatırılan tasarım sermayesi (framer-motion animasyonları,
custom shadow'lar, polished bileşen kütüphanesi) v2'ye taşınmadı.

Sonuç: kullanıcı `/login` veya `/demo/dashboard/...` üzerinden bağlandığında
v1 sayfalarını premium görünür halde görüyor, sonra `/:slug/dashboard`'a
girdiğinde aniden form-tarzı, gri tonlu, animasyonsuz bir arayüze
düşüyor. **Bu marka tutarlılığını kırıyor ve ürünün hazır olmadığı
algısını yaratıyor.**

Bu doküman ortak bir tasarım dili + bileşen kütüphanesi + sayfa
prioriteleriyle bu uçurumu kapatmak için fazlı bir plan sunar.

## Hedefler / Hedef Olmayanlar

**Hedef:**
- v2 sayfalarının v1 dashboard'la görsel olarak ayırt edilemez olması
- Form input, table, empty-state, error-state için **tek sefer** yazılan,
  her sayfada `<Input/>` `<Table/>` `<EmptyState/>` olarak çağrılan
  primitive bileşenler
- TR formatters (TRY, tarih, kısa-tarih) tek bir `lib/utils.ts`'den
- Yeni Tenant Dashboard — gerçek widget'larla
  (banka net akışı, son POS satışları, vergi takvimi özeti) — `TenantDashboardStub`'ın yerine

**Hedef Değil (bu plan kapsamında):**
- Marka kimliği yeniden çizimi (logo, isim, ton değişmez)
- Tasarım tool'una (Figma) iş aktarımı — kod-first yaklaşım
- Mobil-first sıfırdan layout — mevcut responsive Tailwind grid yeterli
- Dark mode

## Mevcut Durum (somut, dosya referanslı)

**v1 polished sayfalar:**
- `apps/web/src/pages/HomePage.tsx`, `DashboardPage.tsx`
- 12+ `components/dashboard/*.tsx` bileşeni (`KPICards`, `RiskIndicator`,
  `CashFlowChart`, `TaxRecommendations`, `AgentTrace` …) — framer-motion
  ile staggered animasyonlar, `RiskIndicator`'da SVG pathLength gauge
- `components/layout/Navbar.tsx` — sticky, `backdrop-blur-sm`, motion'lu
- `tailwind.config.ts` — `bg-hero-grid` gradient, `shadow-card/card-hover/glow`,
  custom `shimmer/slide-up/fade-in/pulse-dot` animasyonları
- `index.css:38-70` — `.card`, `.btn-primary/secondary/ghost`, `.badge`,
  `.skeleton` standartları (zaten var ama v2 sayfalar kullanmıyor)

**v2 minimal sayfalar (tasarım borcu):**
- `pages/TenantDashboardStub.tsx` — 20 satır placeholder, tek `<Link>`
- `pages/IntegrationsPage.tsx`, `TaxCalendarPage.tsx`, `EFaturaPage.tsx`,
  `POSPage.tsx` — inline Tailwind form, plain `<table>`, motion yok
- `components/layout/TenantLayout.tsx` — plain top-bar nav, motion yok
- Her sayfa `Intl.NumberFormat` veya `Intl.DateTimeFormat`'ı yeniden
  tanımlıyor (POSPage:12-16, IntegrationsPage:32, TaxCalendarPage:28)
- `text-neutral-500/600/700` ile `text-navy-*` palette drift'i

**Tutarsızlıklar — somut:**
- POSPage:178 inline `bg-navy-900 px-3 py-1.5 text-white` — `.btn-primary` var ama kullanılmamış
- IntegrationsPage:150-189 ve POSPage:207-249 — iki ayrı plain `<table>`,
  ortak primitive yok
- v1 empty state = HomePage:150+ styled cards; v2 empty state = `<p>Henüz hareket yok</p>`
- Loading: v1 = Skeleton grid; v2 = `<p>Yükleniyor…</p>`

## Tasarım Sistemi Kararları

### 1. Palette
- **Primary:** `navy-*` (mevcut `tailwind.config.ts:6-18`)
- **Success:** `emerald-*`
- **Warning:** `amber-*`
- **Danger:** `red-*` (Tailwind default, custom değil)
- **YASAK:** `neutral-*`, `gray-*`, `slate-*` — bu paletler v1'de yok,
  drift yaratır. v2 sayfalarda görülen `text-neutral-600` → `text-navy-500`

### 2. Tipografi (mevcut korunur)
- Headings (`h1-h6`) → Plus Jakarta Sans (`font-display`)
- Body → Inter
- Numerik (tutar, tarih) → `font-mono` (Tailwind default mono)

### 3. Motion (yeni standart)
Her v2 sayfasında **en az bir** giriş animasyonu olmalı (v1 ile tutarlı).
Kural:
- Sayfa girişi → `fade-in` veya `slide-up` (`tailwind.config.ts:25-30`)
- Liste/kart staggering → her item `delay: index * 0.05`, `duration: 0.3`
- Skeleton → `shimmer` keyframe (`index.css`)

### 4. Spacing
- Sayfa container: `max-w-7xl mx-auto px-6 py-8` (v1 ile aynı)
- Section'lar arası: `space-y-8`
- Card içi: `p-6` (büyük) veya `p-4` (kompakt)

### 5. Radius & Shadows
- `rounded` (4px), `rounded-md` (6px), `rounded-lg` (8px), `rounded-xl` (12px) — `tailwind.config.ts:36-43`'te tanımlı
- Card → `shadow-card`; hover → `shadow-card-hover`
- v2 sayfalarda görülen plain `border border-border` → `shadow-card border border-border/50` ile değiştir

## Bileşen Kütüphanesi (Primitives)

Yeni dosya: `apps/web/src/components/ui/`. Mevcut `shared/` toast/spinner/skeleton'da kalır; `ui/` form & data primitives'i için.

### Sprint 1'de eklenecekler

```
components/ui/
├── Input.tsx          # <Input label="..." error="..." />
├── Select.tsx         # native <select> styled wrapper
├── Button.tsx         # variant: primary | secondary | ghost | danger
├── Card.tsx           # <Card><Card.Header/><Card.Body/></Card>
├── DataTable.tsx      # generic <DataTable<T> columns={...} rows={...} />
├── EmptyState.tsx     # icon + title + message + optional CTA
├── StatusBadge.tsx    # variant: success | warning | danger | neutral
├── KpiCard.tsx        # label + value + optional trend
└── PageHeader.tsx     # title + subtitle + actions (sağ)
```

Ortak ilkeler:
- Her bileşen TypeScript `interface Props` ile başlar
- `cn(...)` helper'ı (`clsx` veya basit join) — class composition için
- Test edilebilir: `DataTable` için 1 unit test (sort/empty davranışı)

### lib/

```
lib/
├── utils.ts           # formatTRY, formatDate, formatDateTime, cn helper
└── format.ts          # daha gelişmiş: relative time ("3 gün sonra")
```

POSPage:12-16, IntegrationsPage:32, TaxCalendarPage:28'deki tekrarlı `Intl.NumberFormat` tanımları silinir, `formatTRY` import edilir.

## Sayfa-Sayfa Refactor Planı

### Öncelik 1 — Tenant Dashboard (gerçek widget'lar)
**Hedef:** `TenantDashboardStub` → çalışan dashboard.

Layout (mobile: stacked, md+: grid):
```
┌─ PageHeader (slug + son güncelleme)
├─ KPI Grid (4 kart):
│   • Bu ay net akış (banka)
│   • Bu ay POS satışı
│   • Yaklaşan vergiler (count + ilk vade)
│   • Açık entegrasyonlar
├─ İki kolonlu grid:
│   • Sol: CashFlowChart (banka + POS birleştirilmiş — v1 chart reuse)
│   • Sağ: Yaklaşan vergi takvimi (3 kalem, "tümü →" linki)
└─ Son aktivite (v1 AgentTrace stilinde): son 10 banka/POS/efatura olayı
```

Reuse: `KpiCard` (yeni), `CashFlowChart` (v1 component, prop'ları
tenant verisine remap), `RiskIndicator` (banka katmanından risk skoru).

### Öncelik 2 — IntegrationsPage refactor
- Dropzone'u v1'in HomePage upload-zone tasarımına yaklaştır
- Banka hareketleri tablosu → `DataTable` primitive
- Entegrasyon kartları → `Card.Header/Body` yapısı

### Öncelik 3 — TaxCalendarPage refactor
- Üç bölüm (Gecikmiş/Yaklaşan/Ödenmiş) → `Tabs` veya `SectionHeader`
- Her kalem → reusable `TaxItem` bileşeni (status badge + countdown)
- Şu an inline `STATUS_CLASSES` mapping → `StatusBadge` primitive

### Öncelik 4 — POSPage refactor
- KPI grid → `KpiCard` primitives
- Tablo → `DataTable`
- Form → `Input`/`Select`/`Button`
- Webhook URL kartı → `Card` (warning variant)

### Öncelik 5 — EFaturaPage refactor
- Form → `Input`/`Select`/`Button`
- Mevcut durum kartı → `Card`
- Webhook URL kartı → `Card` (warning variant)

### Öncelik 6 — TenantLayout polish
- Top-bar yerine **kalıcı sol sidebar** (v1 Navbar stilinde motion)
- Aktif tenant ismi + slug rozeti üst sol köşede
- Sidebar linkleri: Dashboard, Banka, POS, e-Fatura, Vergi Takvimi, Ayarlar
- `motion.aside` ile giriş animasyonu
- Alt-sol: kullanıcı menüsü (email + signOut)

### Öncelik 7 — Auth sayfaları (Login/Register)
- v1 HomePage hero estetiğine yakın layout
- Form alanları → `Input` primitive
- Marka logosu + tagline üstte
- Register: mevcut KOBI bilgi adımları + OnboardingWizard ile birleştir

## Fazlı Uygulama Planı

Her sprint ayrı PR, branch isimlendirme: `feat/design-sprint-N-<konu>`.

### Sprint A — Primitives + lib (foundation)
- `components/ui/*` 9 bileşen + her biri için kısa hikaye
- `lib/utils.ts` formatters
- Dokümantasyon: `docs/ui-primitives.md` (her bileşenin örnek kullanımı)
- **Verification:** mevcut v2 sayfalar değişmez; sadece primitive'ler test edilir (`npm test`)

### Sprint B — Tenant Dashboard (Öncelik 1)
- `TenantDashboardStub` → `TenantDashboard.tsx`
- Yeni hook: `useTenantDashboard(slug)` — banka + POS + vergi takvimi paralel fetch
- KPI'lar gerçek verilerle
- `CashFlowChart` v1'den reuse
- **Verification:** Manuel — kayıttan sonra `/{slug}/dashboard`'da KPI'lar dolu görünür

### Sprint C — TenantLayout + Auth polish (Öncelik 6 + 7)
- Sidebar refaktör (`motion.aside`)
- Login/Register sayfaları primitive'lerle yeniden yazılır
- Register'a OnboardingWizard adımları eklenir
- **Verification:** Yeni kullanıcı `/register` → `/onboarding` (yeni) → `/{slug}/dashboard` akışı end-to-end

### Sprint D — IntegrationsPage + TaxCalendarPage (Öncelik 2 + 3)
- DataTable, EmptyState, StatusBadge'i mevcut sayfalara uygula
- Banka hareketleri tablosunda sıralama, filtre (kategori)
- Vergi takvimi `Tabs`
- **Verification:** Cross-tenant test'ler hâlâ yeşil; sayfa görsel olarak v1 ile tutarlı

### Sprint E — POSPage + EFaturaPage (Öncelik 4 + 5)
- Aynı primitive'ler
- POS'a basit gerçek-zamanlı sentinel: her 15s polling yerine SSE event'i denemesi (deferred — Faz 7)
- **Verification:** Mevcut test'ler yeşil

### Sprint F — Empty/Loading/Error pattern teyit
- Tüm v2 sayfalarda `EmptyState` + `Skeleton` + `<ErrorBoundary>` doğru bağlı
- Toast pattern v1 ile aynı (mutation onSuccess/onError → `useToast()`)
- **Verification:** Görsel checklist — her sayfa 4 durumda (boş/yükleniyor/hata/dolu) screenshot

## Risk & Ödün

1. **Sprint A çok geniş:** 9 primitive ayni anda yazmak demek. Mitigation: Sprint A'yı 2'ye böl (A1 = Button/Input/Select/Card, A2 = DataTable/EmptyState/StatusBadge/KpiCard/PageHeader). Toplam ~10 günlük iş.
2. **CashFlowChart reuse fail edebilir:** v1 chart `AnalysisResult` cash_flow_forecast struct'ı bekler; tenant dashboard'unda bu yapı yok (banka + POS verisini elle uyumlamamız gerekecek). Mitigation: Sprint B başında `lib/forecast-adapter.ts` yaz, mock verisiyle önce chart'ı boyat, sonra gerçek veriye bağla.
3. **TenantLayout sidebar değişikliği breaking:** Mevcut yatay nav route'ları yeni sidebar'a göç ederken layout shift olur. Mitigation: Feature flag (`USE_SIDEBAR_NAV=true`) ile kademeli rollout; iki layout aynı anda var olur, env'le seçilir.
4. **CSS bundle büyür:** Tailwind purge ile yan etki düşük. Build artifact'ı izle (`npm run build` sonrası dist/assets size).
5. **Test debt:** v2 sayfalarda vitest yok şu an. Primitive'ler için test yazılırken sayfa-level smoke test'leri de eklenmeli (en azından "render düşmüyor").

## Kritik Dosyalar

| Dosya | Sprint | Değişiklik |
|-------|--------|------------|
| `components/ui/*` (yeni) | A | 9 primitive |
| `lib/utils.ts` (yeni) | A | formatters + cn |
| `pages/TenantDashboardStub.tsx` → `TenantDashboard.tsx` | B | tam yeniden yaz |
| `hooks/useTenantDashboard.ts` (yeni) | B | paralel fetch |
| `components/layout/TenantLayout.tsx` | C | sidebar refaktör |
| `pages/auth/Login,RegisterPage.tsx` | C | primitive'lerle yeniden |
| `pages/IntegrationsPage.tsx` | D | DataTable + EmptyState |
| `pages/TaxCalendarPage.tsx` | D | StatusBadge + Tabs |
| `pages/POSPage.tsx` | E | DataTable + KpiCard + Input |
| `pages/EFaturaPage.tsx` | E | Card + Input + Button |
| `tailwind.config.ts` | A | yeni hiçbir token gerekli değil — mevcut yeterli |
| `index.css` | A | yeni utility class eklenmez; primitive'ler kendi class'larını yazar |

## Doğrulama

**Her sprint sonu:**
- `npm run typecheck` temiz
- `npm run build` < 4s, bundle < 1.2 MB gzipped (mevcut: 307 KB gz)
- `npm test` yeşil (mevcut 24 + sprint başına min. 2 yeni primitive testi)
- Görsel checklist: aynı sayfayı v1 dashboard ile yan yana açıp tutarlılık kontrol

**Sprint F sonu — kabul kriteri:**
- v2 sayfalarda hiçbir `text-neutral-*` veya `bg-neutral-*` kalmasın
- Hiçbir sayfada yerel `Intl.NumberFormat` tanımı kalmasın (`grep -r "new Intl.NumberFormat" apps/web/src/pages` boş)
- Her v2 sayfa: motion + primitive bileşen kullanımı + empty/loading state ile yazılmış
- `TenantDashboardStub` ismi repodan tamamen silinmiş

## Açık Kararlar (uygulamadan önce)

1. **Sidebar mı yatay nav mı kalsın?** Sprint C öncesi karar.
   Öneri: Sidebar — daha çok ekran genişliği data tablolarına kalır,
   v1 Navbar'ın motion estetiği kalıcı solda durur.
2. **TenantDashboard'da hangi widget'lar ilk sürümde olsun?**
   KPI 4'ü mü 6'sı mı? Öneri: 4 (basit), dashboard büyütüldükçe eklenir.
3. **Empty state'lerde illüstrasyon mu yoksa sadece text + icon mu?**
   Öneri: Lucide icon + text (illüstrasyon bütçeyi şişirir).
4. **Marka renkleri sabit mi?** Mevcut navy/emerald/amber'a sadık kalalım,
   yeni marka çalışması bu plana dahil değil.
5. **Component test stratejisi:** Vitest + RTL? Veya yalnızca smoke
   render testi? Sprint A başında belirle.
