"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { nhostAuth, Session } from "@/lib/auth/nhostAuth";

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Deliberately not a lazy useState initializer: this must start at
    // `null` on both the server-rendered pass and the client's first paint
    // (localStorage doesn't exist on the server) and only pick up the real
    // session after mount — the standard isomorphic-effect pattern for a
    // client-only external store, which avoids a hydration mismatch at the
    // cost of the one-time synchronous setState the lint rule flags here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(nhostAuth.getSession());
    setLoading(false);
    const unsubscribe = nhostAuth.onChange(setSession);
    return () => {
      unsubscribe();
    };
  }, []);

  const value: AuthContextValue = {
    session,
    loading,
    signIn: (email, password) => nhostAuth.signIn(email, password),
    signUp: (email, password) => nhostAuth.signUp(email, password),
    signOut: () => nhostAuth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
