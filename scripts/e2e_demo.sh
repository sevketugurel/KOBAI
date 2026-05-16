#!/usr/bin/env bash
# Faz 4 e2e doğrulama — kuzey-market demo: health → demo/load → poll → chat → approve → PDF.
# Üç ardışık geçen koşunun script: for i in 1 2 3; do bash scripts/e2e_demo.sh || exit 1; done
#
# Gerekli env:
#   KOBAI_API_URL   (varsayılan http://localhost:8000)
#   KOBAI_JWT       (Supabase JWT — kuzey-market üyesi)
#
# Bağımlılıklar: curl, jq.

set -euo pipefail

API="${KOBAI_API_URL:-http://localhost:8000}"
JWT="${KOBAI_JWT:-}"
SLUG="kuzey-market"
TIMEOUT_SECS="${KOBAI_E2E_TIMEOUT:-60}"

if [[ -z "${JWT}" ]]; then
  echo "[e2e] HATA: KOBAI_JWT env var tanımlı değil" >&2
  exit 2
fi

H_AUTH=(-H "Authorization: Bearer ${JWT}")
H_JSON=(-H "Content-Type: application/json")

log() { printf "\033[36m[e2e]\033[0m %s\n" "$*"; }
fail() { printf "\033[31m[e2e][FAIL]\033[0m %s\n" "$*" >&2; exit 1; }

# 1. Health + Chroma
log "1/7 health"
HEALTH=$(curl -fsS "${API}/health")
echo "${HEALTH}" | jq -e '.status == "ok"' >/dev/null || fail "health.status != ok"
echo "${HEALTH}" | jq -e '.chroma == true' >/dev/null || fail "health.chroma != true (ChromaDB bağlantısı yok?)"

# 2. Demo yükleme
log "2/7 demo/load"
LOADED=$(curl -fsS -X POST "${H_AUTH[@]}" "${H_JSON[@]}" "${API}/v2/${SLUG}/demo/load" -d '{}')
JOB_ID=$(echo "${LOADED}" | jq -r '.job_id')
INV_COUNT=$(echo "${LOADED}" | jq -r '.invoice_count')
[[ "${JOB_ID}" != "null" && -n "${JOB_ID}" ]] || fail "job_id alınamadı: ${LOADED}"
[[ "${INV_COUNT}" -ge 24 ]] || fail "beklenen 24 fatura, gelen: ${INV_COUNT}"
log "  job_id=${JOB_ID} invoices=${INV_COUNT}"

# 3. Polling — completed olana kadar
log "3/7 poll (timeout ${TIMEOUT_SECS}s)"
DEADLINE=$(( $(date +%s) + TIMEOUT_SECS ))
STATUS=""
while [[ $(date +%s) -lt ${DEADLINE} ]]; do
  RESULT=$(curl -fsS "${H_AUTH[@]}" "${API}/v2/${SLUG}/analyze/${JOB_ID}")
  STATUS=$(echo "${RESULT}" | jq -r '.status')
  [[ "${STATUS}" == "completed" || "${STATUS}" == "failed" ]] && break
  sleep 1
done
[[ "${STATUS}" == "completed" ]] || fail "pipeline tamamlanamadı (status=${STATUS})"

# 4. KPI / öneri assertion'ları
log "4/7 assertions"
echo "${RESULT}" | jq -e '.cash_flow_forecast | length >= 1' >/dev/null || fail "cash_flow_forecast boş"
echo "${RESULT}" | jq -e '.kosgeb_suggestions | length >= 1' >/dev/null || fail "KOSGEB önerisi yok (BUG-1 regresyonu?)"
echo "${RESULT}" | jq -e '.tax_recommendations | length >= 1' >/dev/null || fail "tax_recommendations boş"
echo "${RESULT}" | jq -e '[.tax_recommendations[] | select(.source != null and .source != "")] | length >= 1' >/dev/null \
  || fail "tax_recommendations citation'sız"

# 5. Chat — KDV + global mevzuat (BUG-2 regression guard)
log "5/7 chat"
SESSION_ID="e2e-$(date +%s)"
CHAT_RES=$(curl -fsS -N -X POST "${H_AUTH[@]}" "${H_JSON[@]}" "${API}/v2/${SLUG}/chat" \
  -d "{\"message\":\"Bu ay KDV ne kadar?\",\"session_id\":\"${SESSION_ID}\"}" \
  --max-time 30 || true)
echo "${CHAT_RES}" | grep -q "data:" || fail "chat SSE yanıtı boş"

# 6. Approve (HITL gate)
log "6/7 approve"
BLOCKED=$(curl -s -o /dev/null -w "%{http_code}" "${H_AUTH[@]}" "${API}/v2/${SLUG}/analyze/${JOB_ID}/report")
[[ "${BLOCKED}" == "403" ]] || fail "approve öncesi rapor 403 değil (gelen=${BLOCKED})"
APPR=$(curl -fsS -X POST "${H_AUTH[@]}" "${H_JSON[@]}" "${API}/v2/${SLUG}/analyze/${JOB_ID}/approve" -d '{}')
echo "${APPR}" | jq -e '.approved == true' >/dev/null || fail "approve yanıtı approved=true değil"

# 7. PDF indirme + boyut + magic byte
log "7/7 report PDF"
PDF=$(mktemp -t kobai-e2e-XXXXXX.pdf)
trap 'rm -f "${PDF}"' EXIT
curl -fsS "${H_AUTH[@]}" -o "${PDF}" "${API}/v2/${SLUG}/analyze/${JOB_ID}/report"
SIZE=$(wc -c < "${PDF}" | tr -d ' ')
[[ "${SIZE}" -gt 1024 ]] || fail "PDF boyutu ${SIZE} byte (>1024 bekleniyordu)"
head -c 4 "${PDF}" | grep -q "%PDF" || fail "PDF magic byte yok"

log "PASS — job=${JOB_ID} pdf=${SIZE}B"
