"""Süreç-içi (in-process) ajan event bus.

Faz 1 kapsamında basit bir async pub/sub:
- `emit(event)` event'i kuyruğa atar; bağlı handler'lar background task olarak çalışır.
- Handler'lar `subscribe(handler)` ile kaydedilir.
- Hata izolasyonu: bir handler patlarsa diğerleri etkilenmez.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Any, Awaitable, Callable

from pydantic import BaseModel, Field

log = logging.getLogger(__name__)


class AgentEvent(BaseModel):
    tenant_id: str
    event_type: str
    payload: dict[str, Any] = Field(default_factory=dict)
    occurred_at: datetime = Field(default_factory=datetime.utcnow)


EventHandler = Callable[[AgentEvent], Awaitable[None]]


class AgentEventBus:
    def __init__(self) -> None:
        self._handlers: list[EventHandler] = []

    def subscribe(self, handler: EventHandler) -> None:
        if handler not in self._handlers:
            self._handlers.append(handler)

    def unsubscribe(self, handler: EventHandler) -> None:
        if handler in self._handlers:
            self._handlers.remove(handler)

    async def emit(self, event: AgentEvent) -> None:
        """Fire-and-forget; her handler için background task açar."""
        for handler in list(self._handlers):
            try:
                asyncio.create_task(self._safe_call(handler, event))
            except RuntimeError:
                # Event loop yoksa (test bağlamı) senkron en iyi-effort.
                log.warning("AgentEventBus: event loop yok, handler atlandı")

    async def emit_and_wait(self, event: AgentEvent) -> None:
        """Tüm handler'ların tamamlanmasını bekler. Testlerde deterministik akış için."""
        await asyncio.gather(
            *[self._safe_call(h, event) for h in list(self._handlers)],
            return_exceptions=True,
        )

    @staticmethod
    async def _safe_call(handler: EventHandler, event: AgentEvent) -> None:
        try:
            await handler(event)
        except Exception:  # noqa: BLE001
            log.exception(
                "AgentEvent handler failed: tenant=%s event=%s",
                event.tenant_id, event.event_type,
            )


_bus: AgentEventBus | None = None


def get_event_bus() -> AgentEventBus:
    global _bus
    if _bus is None:
        _bus = AgentEventBus()
    return _bus


def _reset_for_tests() -> None:
    global _bus
    _bus = None
