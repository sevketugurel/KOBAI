"""FastAPI app — KOBİ Advisor API girişi."""
import logging
import chromadb
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings

log = logging.getLogger(__name__)
logging.basicConfig(level=settings.log_level)

app = FastAPI(title="KOBİ Advisor API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _ping_chroma() -> None:
    try:
        client = chromadb.HttpClient(
            host=settings.chroma_host, port=settings.chroma_port
        )
        client.get_or_create_collection(name=settings.chroma_collection)
        log.info(
            "ChromaDB bağlantısı tamam: koleksiyon=%s", settings.chroma_collection
        )
    except Exception as e:  # noqa: BLE001
        log.warning("ChromaDB erişilemedi (%s); RAG çalışmayacak.", e)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "version": "0.1.0"}


# Router'lar — Faz 4
from routers import upload as upload_router
from routers import analyze as analyze_router
from routers import chat as chat_router
from routers import report as report_router

app.include_router(upload_router.router)
app.include_router(analyze_router.router)
app.include_router(chat_router.router)
app.include_router(report_router.router)
