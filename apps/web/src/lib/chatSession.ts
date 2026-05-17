export function getOrCreateSessionId(slug: string): string {
  if (typeof window === "undefined" || !slug) return "default";
  const key = `kobai.chat.session.${slug}`;
  let id = window.localStorage.getItem(key);
  if (!id) {
    id = window.crypto?.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(key, id);
  }
  return id;
}
