"use client";

import { useEffect } from "react";
import { useQuery } from "urql";
import { ORG_USAGE } from "@/lib/graphql/operations";

export function QuotaIndicator({ orgId }: { orgId: string }) {
  const [{ data, fetching }, reexecute] = useQuery({
    query: ORG_USAGE,
    variables: { orgId },
    requestPolicy: "cache-and-network",
  });

  // No subscription on the aggregate view (only step_runs is required to be
  // live) — a light poll is a cheap way to keep this reasonably fresh
  // without one, including for usage consumed by scheduled/webhook-
  // triggered runs happening with nobody watching the Run button.
  useEffect(() => {
    const id = setInterval(() => reexecute({ requestPolicy: "network-only" }), 10_000);
    return () => clearInterval(id);
  }, [reexecute]);

  const org = data?.organizations?.[0];
  if (fetching && !org) return <div className="text-xs text-slate-400">usage…</div>;
  if (!org) return null;

  const used = org.usageThisMonth?.calls_used ?? 0;
  const allowed = org.quota_calls_allowed ?? 0;
  const pct = allowed > 0 ? Math.min(100, Math.round((used / allowed) * 100)) : 0;
  const barColor = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="flex items-center gap-2 text-xs text-slate-600" title={`${used} / ${allowed} calls used this period`}>
      <span className="whitespace-nowrap">
        {used} / {allowed} calls
      </span>
      <div className="w-24 h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
