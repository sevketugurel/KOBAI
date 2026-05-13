"""Fernet-bazlı küçük ucu — entegrasyon kimlik bilgileri için.

Faz 5 ve Faz 6 tarafından paylaşılır. Branch'ler ayrı geliştirildiyse
aynı içerikle iki kez eklenmiş olabilir; merge sırasında tek dosya kalır.
"""

from __future__ import annotations

import base64
import json
import logging
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from config import settings

log = logging.getLogger(__name__)


class EncryptionNotConfigured(RuntimeError):
    """ENCRYPTION_KEY tanımsız."""


class EncryptionError(RuntimeError):
    """Fernet decrypt başarısız."""


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    if not settings.encryption_key:
        raise EncryptionNotConfigured("ENCRYPTION_KEY .env'de tanımlanmalı")
    key = settings.encryption_key.encode("utf-8")
    try:
        return Fernet(key)
    except Exception as e:  # noqa: BLE001
        raise EncryptionNotConfigured(
            "ENCRYPTION_KEY Fernet uyumlu değil (32 byte url-safe base64)"
        ) from e


def _reset_for_tests() -> None:
    _fernet.cache_clear()


def encrypt_credentials(payload: dict) -> str:
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
    return _fernet().encrypt(raw).decode("ascii")


def decrypt_credentials(blob: str) -> dict:
    try:
        raw = _fernet().decrypt(blob.encode("ascii"))
    except InvalidToken as e:
        raise EncryptionError("ciphertext bozuk veya yanlış anahtar") from e
    return json.loads(raw.decode("utf-8"))


if __name__ == "__main__":
    print(Fernet.generate_key().decode())
