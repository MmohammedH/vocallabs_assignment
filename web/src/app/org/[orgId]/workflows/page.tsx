"use client";

import Link from "next/link";
import { useQuery } from "urql";
import { useOrg } from "@/context/OrgContext";
import { RoleGate } from "@/components/common/RoleGate";
import { GET_ORG_WORKFLOWS } from "@/lib/graphql/operations";

type WorkflowRow = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  latestRun: { id: string; status: string; trigger_type: string }[];
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600",
  running: "bg-blue-100 text-blue-700",
  paused: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-500",
};

export default function WorkflowsListPage() {
  const { orgId } = useOrg();
  const [{ data, fetching, error }] = useQuery<{ workflows: WorkflowRow[] }>({
    query: GET_ORG_WORKFLOWS,
    variables: { orgId },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Workflows</h1>
        <RoleGate allow={["owner", "editor"]}>
          <Link href={`/org/${orgId}/workflows/new`} className="rounded-md bg-slate-900 text-white text-sm px-4 py-2">
            New workflow
          </Link>
        </RoleGate>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error.message}</p>}
      {fetching && <p className="text-sm text-slate-500">Loading…</p>}

      {!fetching && (data?.workflows.length ?? 0) === 0 && (
        <p className="text-sm text-slate-500">No workflows yet.</p>
      )}

      <ul className="space-y-2">
        {data?.workflows.map((wf) => {
          const latest = wf.latestRun[0];
          return (
            <li key={wf.id}>
              <Link
                href={`/org/${orgId}/workflows/${wf.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-slate-400 transition"
              >
                <div>
                  <p className="font-medium">{wf.name}</p>
                  {wf.description && <p className="text-sm text-slate-500">{wf.description}</p>}
                </div>
                {latest && (
                  <span className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[latest.status] ?? "bg-slate-100"}`}>
                    {latest.status}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
