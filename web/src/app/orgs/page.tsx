"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "urql";
import { useAuth } from "@/context/AuthContext";
import { MY_ORG_MEMBERSHIPS } from "@/lib/graphql/operations";
import type { Membership } from "@/context/OrgContext";

export default function OrgsPage() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const [{ data, fetching, error }] = useQuery<{ org_members: Membership[] }>({
    query: MY_ORG_MEMBERSHIPS,
    pause: !session,
  });

  useEffect(() => {
    if (!authLoading && !session) router.replace("/login");
  }, [authLoading, session, router]);

  if (authLoading || fetching) {
    return <div className="flex-1 flex items-center justify-center text-slate-500">Loading…</div>;
  }

  const memberships = data?.org_members ?? [];

  return (
    <div className="flex-1 p-6 max-w-lg mx-auto w-full">
      <h1 className="text-xl font-semibold mb-1">Your organizations</h1>
      <p className="text-sm text-slate-500 mb-6">Signed in as {session?.user.email}</p>
      {error && <p className="text-sm text-red-600 mb-4">{error.message}</p>}
      {memberships.length === 0 ? (
        <p className="text-sm text-slate-500">
          You&apos;re not a member of any organization yet. Ask an owner to add you, or run the seed script.
        </p>
      ) : (
        <ul className="space-y-2">
          {memberships.map((m) => (
            <li key={m.organization.id}>
              <button
                onClick={() => router.push(`/org/${m.organization.id}/workflows`)}
                className="w-full flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-left hover:border-slate-400 transition"
              >
                <span className="font-medium">{m.organization.name}</span>
                <span className="text-xs uppercase tracking-wide text-slate-500 bg-slate-100 px-2 py-1 rounded">{m.role}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
