"""LangGraph orchestrator — parse → cashflow → risk → tax_rag → kosgeb → approve → report."""
import time
from datetime import datetime
from operator import add
from typing import TypedDict, Any, Annotated
from langgraph.graph import StateGraph, END

from schemas.invoice import InvoiceData
from schemas.analysis import AnalysisResult, AgentStep
from agents.nakit_akisi import NakitAkisiAgent
from agents.risk import RiskAgent
from agents.mevzuat_rag import MevzuatRagAgent
from agents.kosgeb import suggest_kosgeb


class AgentState(TypedDict, total=False):
    job_id: str
    # v2: tenant bağlamı. None → v1 demo modu (yalnızca global RAG).
    tenant_id: str | None
    invoices: list[InvoiceData]
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


def _step(*, agent: str, action: str, t0: float, output: Any, confidence: float = 4.0) -> AgentStep:
    return AgentStep(
        agent_name=agent, action=action, input={}, output={"summary": str(output)[:200]},
        duration_ms=int((time.perf_counter() - t0) * 1000), confidence=confidence,
    )


async def _cashflow_node(state: AgentState) -> dict:
    t0 = time.perf_counter()
    out = await NakitAkisiAgent().forecast(state["invoices"])
    return {
        "forecast": out,
        "trace": [_step(agent="nakit_akisi", action="forecast 3ay", t0=t0, output=f"{len(out)} ay")],
    }


async def _risk_node(state: AgentState) -> dict:
    t0 = time.perf_counter()
    out = await RiskAgent().assess(state["invoices"], state["forecast"])
    return {
        "risk": out,
        "trace": [_step(agent="risk", action="assess", t0=t0, output=out["risk_label"])],
    }


async def _tax_node(state: AgentState) -> dict:
    t0 = time.perf_counter()
    # v2: tenant_id varsa private + global RAG; yoksa salt global (v1 demo).
    agent = MevzuatRagAgent(tenant_id=state.get("tenant_id"))
    out = await agent.analyze(state["invoices"])
    return {
        "tax_recs": out,
        "trace": [_step(agent="mevzuat_rag", action=f"{len(out)} öneri", t0=t0, output=len(out))],
    }


async def _kosgeb_node(state: AgentState) -> dict:
    t0 = time.perf_counter()
    out = suggest_kosgeb(sector=state["sector"], company_type=state["company_type"])
    return {
        "kosgeb": out,
        "trace": [_step(agent="kosgeb", action="öneri kuralı", t0=t0, output=len(out))],
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
) -> AnalysisResult:
    init: AgentState = {
        "job_id": job_id, "tenant_id": tenant_id, "invoices": invoices,
        "company_type": company_type, "sector": sector, "period": period,
        "trace": [], "human_approved": auto_approve,
    }
    final = await _graph.ainvoke(init)
    risk = final.get("risk", {"risk_score": 1, "risk_label": "green", "explanation": "n/a"})
    return AnalysisResult(
        job_id=job_id, status="completed", invoices=invoices,
        cash_flow_forecast=final.get("forecast", []),
        risk_score=risk["risk_score"], risk_label=risk["risk_label"],
        risk_explanation=risk["explanation"],
        tax_recommendations=final.get("tax_recs", []),
        kosgeb_suggestions=final.get("kosgeb", []),
        agent_trace=final.get("trace", []),
        created_at=datetime.utcnow(), completed_at=datetime.utcnow(),
    )
