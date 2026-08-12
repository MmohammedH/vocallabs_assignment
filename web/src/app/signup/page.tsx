"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function SignupPage() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await signUp(email, password);
    setSubmitting(false);
    if (error) setError(error);
    else router.replace("/orgs");
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Create account</h1>
        <p className="text-xs text-slate-500">
          Signing up only creates your login — an org owner still needs to add you to an organization (see the seed script / ask an admin) before you can see any workflows.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="space-y-1">
          <label className="text-sm text-slate-600">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-600">Password</label>
          <input
            type="password"
            required
            minLength={9}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-slate-900 text-white py-2 text-sm font-medium disabled:opacity-50"
        >
          {submitting ? "Creating account…" : "Sign up"}
        </button>
        <p className="text-sm text-slate-500 text-center">
          Already have an account? <Link href="/login" className="text-slate-900 underline">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
