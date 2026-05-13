import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { formatAuthError, normalizeAuthEmail } from "./authErrors";
import { supabase } from "./supabaseClient";
const AuthCtx = createContext(undefined);
export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            setLoading(false);
        });
        const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
            setSession(s);
        });
        return () => sub.subscription.unsubscribe();
    }, []);
    const value = useMemo(() => ({
        user: session?.user ?? null,
        session,
        loading,
        async signIn(email, password) {
            const normalized = normalizeAuthEmail(email);
            const { error } = await supabase.auth.signInWithPassword({
                email: normalized,
                password,
            });
            return { error: formatAuthError(error) };
        },
        async signUp(email, password) {
            const normalized = normalizeAuthEmail(email);
            const { error } = await supabase.auth.signUp({ email: normalized, password });
            return { error: formatAuthError(error) };
        },
        async signOut() {
            await supabase.auth.signOut();
        },
    }), [session, loading]);
    return _jsx(AuthCtx.Provider, { value: value, children: children });
}
export function useAuth() {
    const ctx = useContext(AuthCtx);
    if (!ctx)
        throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
