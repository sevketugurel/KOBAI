"""Chat şemaları — POST /chat istek/yanıt."""
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    message: str = Field(min_length=1)
    job_id: str
    history: list[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    content: str
    sources: list[dict] = Field(default_factory=list)
