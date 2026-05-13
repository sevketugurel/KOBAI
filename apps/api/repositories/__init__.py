"""Repository / DAO katmanı — v2 Supabase erişimi tek noktadan.

Tüm sorgular service-role client kullanır → RLS bypass → her metod
explicit `tenant_id`/`user_id` filter uygular. Bu, izolasyon
sorumluluğunu kod katmanında tutar; RLS yalnızca defense-in-depth.
"""
