"use client";

// Minimal nhost Auth client (direct REST calls, no SDK) — kept intentionally
// small: sign up/in/out, session persistence in localStorage, and a
// refresh timer scheduled before the access token expires. Written against
// nhost's plain Auth REST API rather than a version-pinned SDK.

const AUTH_URL = process.env.NEXT_PUBLIC_NHOST_AUTH_URL as string;

export type NhostUser = {
  id: string;
  email: string;
  displayName?: string;
};

export type Session = {
  accessToken: string;
  accessTokenExpiresIn: number; // seconds
  refreshToken: string;
  user: NhostUser;
};

type Listener = (session: Session | null) => void;

const STORAGE_KEY = "vocallabs.session";

class NhostAuthClient {
  private session: Session | null = null;
  private listeners = new Set<Listener>();
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          this.session = JSON.parse(raw);
          this.scheduleRefresh();
        } catch {
          this.session = null;
        }
      }
    }
  }

  getSession() {
    return this.session;
  }

  getAccessToken() {
    return this.session?.accessToken ?? null;
  }

  onChange(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setSession(session: Session | null) {
    this.session = session;
    if (typeof window !== "undefined") {
      if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      else window.localStorage.removeItem(STORAGE_KEY);
    }
    this.listeners.forEach((l) => l(session));
    this.scheduleRefresh();
  }

  private scheduleRefresh() {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    if (!this.session) return;
    // refresh 60s before expiry
    const delayMs = Math.max((this.session.accessTokenExpiresIn - 60) * 1000, 5000);
    this.refreshTimer = setTimeout(() => this.refresh().catch(() => this.setSession(null)), delayMs);
  }

  async signUp(email: string, password: string): Promise<{ error?: string }> {
    const res = await fetch(`${AUTH_URL}/signup/email-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.message || "sign up failed" };
    if (json.session) this.setSession(json.session);
    return {};
  }

  async signIn(email: string, password: string): Promise<{ error?: string }> {
    const res = await fetch(`${AUTH_URL}/signin/email-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.message || "sign in failed" };
    if (json.session) this.setSession(json.session);
    return {};
  }

  async refresh(): Promise<void> {
    if (!this.session?.refreshToken) return;
    const res = await fetch(`${AUTH_URL}/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: this.session.refreshToken }),
    });
    if (!res.ok) {
      this.setSession(null);
      return;
    }
    const json = await res.json();
    this.setSession({
      accessToken: json.accessToken,
      accessTokenExpiresIn: json.accessTokenExpiresIn,
      refreshToken: json.refreshToken,
      user: json.user,
    });
  }

  async signOut(): Promise<void> {
    const refreshToken = this.session?.refreshToken;
    this.setSession(null);
    if (refreshToken) {
      await fetch(`${AUTH_URL}/signout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {});
    }
  }
}

export const nhostAuth = new NhostAuthClient();
