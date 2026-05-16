"""FastAPI app — KOBİ Advisor API girişi."""
import logging
import re
import chromadb
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings

log = logging.getLogger(__name__)
logging.basicConfig(level=settings.log_level)

# Vite / yerel test: localhost ve 127.0.0.1 (tüm portlar)
_DEV_ORIGIN_RE = re.compile(r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$")

app = FastAPI(title="KOBİ Advisor API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _cors_headers(request: Request) -> dict[str, str]:
    origin = request.headers.get("origin")
    if not origin:
        return {}
    if origin in settings.allowed_origins_list or _DEV_ORIGIN_RE.match(origin):
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }
    return {}


@app.exception_handler(HTTPException)
async def _http_exc_cors(request: Request, exc: HTTPException) -> JSONResponse:
    """Hata yanıtlarında da tarayıcının görebileceği CORS başlıkları (özellikle 4xx/5xx)."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=_cors_headers(request),
    )


app.state.chroma_ok = False


@app.on_event("startup")
async def _ping_chroma() -> None:
    try:
        client = chromadb.HttpClient(
            host=settings.chroma_host, port=settings.chroma_port
        )
        client.get_or_create_collection(name=settings.chroma_collection)
        app.state.chroma_ok = True
        log.info(
            "ChromaDB bağlantısı tamam: koleksiyon=%s", settings.chroma_collection
        )
    except Exception as e:  # noqa: BLE001
        app.state.chroma_ok = False
        log.error("ChromaDB erişilemedi (%s); RAG çalışmayacak.", e)


@app.on_event("startup")
async def _init_agent_orchestration() -> None:
    """Faz 7 — event bus'a orchestration service'i subscribe et."""
    try:
        from services.agent_orchestration import get_orchestration_service

        get_orchestration_service()
        log.info("AgentOrchestrationService event bus'a bağlandı.")
    except Exception as e:  # noqa: BLE001
        log.error("Agent orchestration başlatılamadı (%s); event akışı pasif.", e)


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "version": "0.1.0",
        "chroma": bool(getattr(app.state, "chroma_ok", False)),
    }


# Router'lar — v1 (auth-suz, demo data)
from routers import upload as upload_router
from routers import analyze as analyze_router
from routers import chat as chat_router
from routers import report as report_router

app.include_router(upload_router.router)
app.include_router(analyze_router.router)
app.include_router(chat_router.router)
app.include_router(report_router.router)

# Router'lar — v2 (multi-tenant, JWT-bound)
from routers.v2 import tenants as v2_tenants_router
from routers.v2 import chat as v2_chat_router
from routers.v2 import integrations as v2_integrations_router
from routers.v2 import tax_calendar as v2_tax_router  # Faz 4 — register düşmüştü, restore
from routers.v2 import pos as v2_pos_router
from routers.v2 import dashboard as v2_dashboard_router
from routers.v2 import analyze as v2_analyze_router
from routers.v2 import demo as v2_demo_router
from routers.v2 import agents as v2_agents_router

app.include_router(v2_tenants_router.router)
app.include_router(v2_chat_router.router)
app.include_router(v2_integrations_router.router)
app.include_router(v2_tax_router.tenant_router)
app.include_router(v2_tax_router.cron_router)
app.include_router(v2_pos_router.tenant_router)
app.include_router(v2_pos_router.public_router)
app.include_router(v2_dashboard_router.router)
app.include_router(v2_analyze_router.router)
app.include_router(v2_demo_router.router)
app.include_router(v2_agents_router.router)
