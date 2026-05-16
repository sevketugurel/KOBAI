"""LangGraph orchestrator — parse → cashflow → risk → tax_rag → kosgeb → approve → report."""
import time
from datetime import datetime
from operator import add
from typing import Awaitable, Callable, TypedDict, Any, Annotated
from langgraph.graph import StateGraph, END

from schemas.invoice import InvoiceData
from schemas.analysis import AnalysisResult, AgentStep
from agents.nakit_akisi import NakitAkisiAgent
from agents.risk import RiskAgent
from agents.mevzuat_rag import MevzuatRagAgent
from agents.kosgeb import suggest_kosgeb
from services.tenant_context import TenantAnalysisContext


class AgentState(TypedDict, total=False):
    job_id: str
    # v2: tenant bağlamı. None → v1 demo modu (yalnızca global RAG).
    tenant_id: str | None
    invoices: list[InvoiceData]
    tenant_context: TenantAnalysisContext | None
    company_type: str
    sector: str
    period: str
    forecast: list[dict]
    risk: dict
    tax_recs: list[dict]
    kosgeb: list[dict]
    trace: Annotated[list[AgentStep], add]
    error: str | None
    human_approved: bool


TraceSink = Callable[[AgentStep], Awaitable[None]]


def _step(
    *,
    agent: str,
    action: str,
    t0: float,
    input_data: dict | None = None,
    output: Any,
    confidence: float = 4.0,
    status: str = "completed",
) -> AgentStep:
    return AgentStep(
        agent_name=agent,
        action=action,
        status=status,
        input=input_data or {},
        output={"summary": str(output)[:200]},
        duration_ms=int((time.perf_counter() - t0) * 1000),
        confidence=confidence,
    )


async def _cashflow_node(state: AgentState) -> dict:
    t0 = time.perf_counter()
    ctx = state.get("tenant_context")
    out = await NakitAkisiAgent().forecast(state["invoices"], tenant_context=ctx)
    return {
        "forecast": out,
        "trace": [
            _step(
                agent="nakit_akisi",
                action="3 aylık nakit akışı projeksiyonu oluşturuluyor",
                t0=t0,
                input_data={
                    "invoice_count": len(state["invoices"]),
                    "bank_tx_count": len(ctx.bank_transactions) if ctx else 0,
                    "pos_tx_count": len(ctx.pos_transactions) if ctx else 0,
                },
                output=f"{len(out)} aylık tahmin üretildi",
            )
        ],
    }


async def _risk_node(state: AgentState) -> dict:
    t0 = time.perf_counter()
    ctx = state.get("tenant_context")
    out = await RiskAgent().assess(state["invoices"], state["forecast"], tenant_context=ctx)
    return {
        "risk": out,
        "trace": [
            _step(
                agent="risk",
                action="Finansal anomaliler ve eşik değerleri kontrol ediliyor",
                t0=t0,
                input_data={
                    "invoice_count": len(state["invoices"]),
                    "tax_calendar_count": len(ctx.tax_calendar_items) if ctx else 0,
                },
                output=f"Risk Seviyesi: {out['risk_label'].upper()}",
            )
        ],
    }


async def _tax_node(state: AgentState) -> dict:
    t0 = time.perf_counter()
    # v2: tenant_id varsa private + global RAG; yoksa salt global (v1 demo).
    agent = MevzuatRagAgent(tenant_id=state.get("tenant_id"))
    out = await agent.analyze(state["invoices"], tenant_context=state.get("tenant_context"))
    return {
        "tax_recs": out,
        "trace": [
            _step(
                agent="mevzuat_rag",
                action="Güncel vergi mevzuatı ve teşvikler taranıyor",
                t0=t0,
                input_data={"query": "vergi istisnaları ve KDV avantajları"},
                output=f"{len(out)} adet mevzuat önerisi bulundu",
            )
        ],
    }


async def _kosgeb_node(state: AgentState) -> dict:
    t0 = time.perf_counter()
    ctx = state.get("tenant_context")
    out = suggest_kosgeb(
        sector=state["sector"],
        company_type=state["company_type"],
        tenant_context=ctx,
    )
    return {
        "kosgeb": out,
        "trace": [
            _step(
                agent="kosgeb",
                action="Sektörel KOSGEB destekleri ve hibe kriterleri inceleniyor",
                t0=t0,
                input_data={
                    "sector": state["sector"],
                    "type": state["company_type"],
                    "invoice_count": len(ctx.invoices) if ctx else len(state["invoices"]),
                },
                output=f"{len(out)} adet uygun destek programı eşleşti",
            )
        ],
    }


async def _await_human(state: AgentState) -> dict:
    return {"human_approved": state.get("human_approved", True)}


def _build_graph():
    g = StateGraph(AgentState)
    g.add_node("cashflow_node", _cashflow_node)
    g.add_node("risk_node", _risk_node)
    g.add_node("tax_node", _tax_node)
    g.add_node("kosgeb_node", _kosgeb_node)
    g.add_node("approve_node", _await_human)
    g.set_entry_point("cashflow_node")
    g.add_edge("cashflow_node", "risk_node")
    g.add_edge("risk_node", "tax_node")
    g.add_edge("tax_node", "kosgeb_node")
    g.add_edge("kosgeb_node", "approve_node")
    g.add_conditional_edges(
        "approve_node",
        lambda s: "done" if s.get("human_approved") else "approve_node",
        {"done": END, "approve_node": "approve_node"},
    )
    return g.compile()


_graph = _build_graph()


async def run_pipeline(
    *, invoices: list[InvoiceData], company_type: str, sector: str, period: str,
    job_id: str, auto_approve: bool = True, tenant_id: str | None = None,
    tenant_context: TenantAnalysisContext | None = None,
    trace_sink: TraceSink | None = None,
) -> AnalysisResult:
    state: AgentState = {
        "job_id": job_id, "tenant_id": tenant_id, "invoices": invoices,
        "tenant_context": tenant_context,
        "company_type": company_type, "sector": sector, "period": period,
        "trace": [], "human_approved": auto_approve,
    }
    nodes = [
        ("nakit_akisi", "3 aylık nakit akışı projeksiyonu oluşturuluyor", _cashflow_node),
        ("risk", "Finansal anomaliler ve eşik değerleri kontrol ediliyor", _risk_node),
        ("mevzuat_rag", "Güncel vergi mevzuatı ve teşvikler taranıyor", _tax_node),
        ("kosgeb", "Sektörel KOSGEB destekleri ve hibe kriterleri inceleniyor", _kosgeb_node),
    ]
    trace: list[AgentStep] = []
    for agent_name, action, node in nodes:
        running = AgentStep(
            agent_name=agent_name,
            action=action,
            status="running",
            input={"job_id": job_id, "tenant_id": tenant_id},
            output={"summary": "Çalışıyor"},
            duration_ms=0,
            confidence=1.0,
        )
        trace.append(running)
        if trace_sink is not None:
            await trace_sink(running)
        try:
            update = await node(state)
        except Exception as exc:
            failed = AgentStep(
                agent_name=agent_name,
                action=action,
                status="failed",
                input={"job_id": job_id, "tenant_id": tenant_id},
                output={"summary": str(exc)[:200]},
                duration_ms=0,
                confidence=1.0,
            )
            trace.append(failed)
            if trace_sink is not None:
                await trace_sink(failed)
            raise
        completed_steps = update.pop("trace", [])
        for step in completed_steps:
            trace.append(step)
            if trace_sink is not None:
                await trace_sink(step)
        state.update(update)
    final = state
    risk = final.get("risk", {"risk_score": 1, "risk_label": "green", "explanation": "n/a"})
    return AnalysisResult(
        job_id=job_id, status="completed", invoices=invoices,
        cash_flow_forecast=final.get("forecast", []),
        risk_score=risk["risk_score"], risk_label=risk["risk_label"],
        risk_explanation=risk["explanation"],
        tax_recommendations=final.get("tax_recs", []),
        kosgeb_suggestions=final.get("kosgeb", []),
        agent_trace=trace,
        created_at=datetime.utcnow(), completed_at=datetime.utcnow(),
    )
