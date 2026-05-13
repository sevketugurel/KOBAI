import type { AuthError } from "@supabase/supabase-js";

const MSG_INVALID_CREDENTIALS =
  "E-posta veya şifre hatalı. Şifreyi kontrol et; hesabın yoksa kayıt ol. " +
  "Yeni kayıt olduysan önce gelen kutudaki doğrulama bağlantısına tıkla.";

const MSG_EMAIL_NOT_CONFIRMED =
  "E-posta adresin henüz doğrulanmamış. Gelen kutundaki Supabase doğrulama mailine tıkladıktan sonra tekrar giriş yap.";

/** Supabase Auth hata kodlarını kullanıcıya anlaşılır Türkçe metne çevirir. */
export function formatAuthError(error: AuthError | null): string | null {
  if (!error) return null;
  const code = error.code ?? "";

  const byCode: Record<string, string> = {
    invalid_credentials: MSG_INVALID_CREDENTIALS,
    email_not_confirmed: MSG_EMAIL_NOT_CONFIRMED,
    user_already_registered: "Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.",
    weak_password: "Şifre çok zayıf. Daha uzun veya daha güçlü bir şifre seç.",
    signup_disabled: "Yeni kayıtlar şu an kapalı. Yönetici ile iletişime geç.",
    over_request_rate_limit: "Çok fazla deneme yapıldı. Bir süre sonra tekrar dene.",
  };

  const mapped = code ? byCode[code] : undefined;
  if (mapped) return mapped;

  const msg = (error.message ?? "").toLowerCase();
  if (msg.includes("invalid login credentials") || msg.includes("invalid credentials")) {
    return MSG_INVALID_CREDENTIALS;
  }
  if (msg.includes("email not confirmed")) {
    return MSG_EMAIL_NOT_CONFIRMED;
  }

  return error.message ?? "Bir hata oluştu. Lütfen tekrar dene.";
}

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}
