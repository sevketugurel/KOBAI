"""v2 middleware paketi.

Adı "middleware" olmasına karşın çoğunluğu FastAPI `Depends()` fabrikalarıdır;
route-level kontrol için ASGI middleware'den daha esnek (v1 endpoint'leri
auth-suz, v2 endpoint'leri tenant-bound kalır).
"""
