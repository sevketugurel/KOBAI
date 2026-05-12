"""Analiz şemaları — orchestrator çıktısı."""
from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, Field, ConfigDict

from schemas.invoice import InvoiceData


class AgentStep(BaseModel):
    model_config = ConfigDict(extra="forbid")
    agent_name: str = Field(description="Ajan kimliği")
    action: str = Field(description="Eylem açıklaması")
    input: dict[str, Any] = Field(default_factory=dict)
    output: dict[str, Any] = Field(default_factory=dict)
    duration_ms: int = Field(ge=0)
    confidence: float = Field(ge=1.0, le=5.0, description="1-5 güven skoru")


class AnalysisResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    job_id: str
    status: Literal["pending", "processing", "completed", "failed"]
    invoices: list[InvoiceData] = Field(default_factory=list)
    cash_flow_forecast: list[dict[str, Any]] = Field(default_factory=list, description="3 aylık tahmin")
    risk_score: int = Field(ge=1, le=5)
    risk_label: Literal["green", "yellow", "red"]
    risk_explanation: str
    tax_recommendations: list[dict[str, Any]] = Field(default_factory=list)
    kosgeb_suggestions: list[dict[str, Any]] = Field(default_factory=list)
    agent_trace: list[AgentStep] = Field(default_factory=list)
    created_at: datetime
    completed_at: datetime | None = None
    error: str | None = None
