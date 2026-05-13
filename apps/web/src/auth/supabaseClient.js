import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
    // Eksik env → uygulama yine açılır; auth/v2 sayfaları "yapılandırılmamış" mesajı gösterir.
    // v1 (/demo) yolu çalışmaya devam eder.
    // eslint-disable-next-line no-console
    console.warn("[supabase] VITE_SUPABASE_URL veya VITE_SUPABASE_ANON_KEY tanımsız. " +
        "v2 auth devre dışı.");
}
export const supabase = createClient(url ?? "https://invalid.invalid", anonKey ?? "invalid", { auth: { persistSession: true, autoRefreshToken: true } });
export const isSupabaseConfigured = () => Boolean(url && anonKey);
