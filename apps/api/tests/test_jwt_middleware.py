"""middleware/tenant.py içindeki require_auth davranışı."""

from __future__ import annotations

import time
import uuid

import jwt
import pytest
from fastapi import HTTPException

from config import settings
from middleware.tenant import require_auth


_SECRET = "test-jwt-secret-do-not-use-in-prod"


@pytest.fixture(autouse=True)
def _set_jwt_secret(monkeypatch):
    monkeypatch.setattr(settings, "supabase_jwt_secret", _SECRET)
    yield


def _make_token(*, sub: str | None = None, aud: str = "authenticated", exp_delta: int = 600, secret: str = _SECRET) -> str:
    now = int(time.time())
    payload: dict = {"aud": aud, "iat": now, "exp": now + exp_delta}
    if sub is not None:
        payload["sub"] = sub
    payload.setdefault("email", "user@example.com")
    return jwt.encode(payload, secret, algorithm="HS256")


def test_require_auth_ok_returns_principal() -> None:
    user_id = str(uuid.uuid4())
    token = _make_token(sub=user_id)
    principal = require_auth(authorization=f"Bearer {token}")
    assert principal.user_id == user_id
    assert principal.email == "user@example.com"


def test_missing_authorization_header_401() -> None:
    with pytest.raises(HTTPException) as exc:
        require_auth(authorization=None)
    assert exc.value.status_code == 401


def test_wrong_scheme_401() -> None:
    with pytest.raises(HTTPException) as exc:
        require_auth(authorization="Basic abcdef")
    assert exc.value.status_code == 401


def test_expired_token_401() -> None:
    token = _make_token(sub=str(uuid.uuid4()), exp_delta=-10)
    with pytest.raises(HTTPException) as exc:
        require_auth(authorization=f"Bearer {token}")
    assert exc.value.status_code == 401
    assert "süresi" in exc.value.detail


def test_wrong_audience_401() -> None:
    token = _make_token(sub=str(uuid.uuid4()), aud="anon")
    with pytest.raises(HTTPException) as exc:
        require_auth(authorization=f"Bearer {token}")
    assert exc.value.status_code == 401


def test_wrong_signature_401() -> None:
    token = _make_token(sub=str(uuid.uuid4()), secret="some-other-secret")
    with pytest.raises(HTTPException) as exc:
        require_auth(authorization=f"Bearer {token}")
    assert exc.value.status_code == 401


def test_missing_sub_claim_401() -> None:
    token = _make_token(sub=None)
    with pytest.raises(HTTPException) as exc:
        require_auth(authorization=f"Bearer {token}")
    assert exc.value.status_code == 401


def test_jwt_secret_unset_returns_503(monkeypatch) -> None:
    monkeypatch.setattr(settings, "supabase_jwt_secret", None)
    with pytest.raises(HTTPException) as exc:
        require_auth(authorization="Bearer whatever")
    assert exc.value.status_code == 503
