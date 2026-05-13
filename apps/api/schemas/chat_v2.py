"""v2 chat şemaları — tenant + session-scoped, job_id opsiyonel."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ChatMessageV2(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str | None = None
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime | None = None


class ChatRequestV2(BaseModel):
    model_config = ConfigDict(extra="forbid")
    message: str = Field(min_length=1)
    session_id: str = Field(min_length=1, max_length=128)
    # İsteğe bağlı: belirli bir analiz job'ına bağlanırsa context'e eklenir.
    job_id: str | None = None
