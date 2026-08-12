"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useQuery } from "urql";
import { GET_WORKFLOW_RUN } from "@/lib/graphql/operations";
import { RunStepList } from "@/components/run-viewer/RunStepList";
import { ForbiddenState } from "@/components/common/ForbiddenState";
import { useOrg } from "@/context/OrgContext";

const RUN_STATUS_STYLES: Record<string, string> = {
  running: "bg-blue-100 text-blue-700",
  paused: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-500",
};

export default function RunViewerPage() {
  const params = useParams<{ orgId: string; runId: string }>();
  const { orgId } = useOrg();

  // One-shot lookup first, so an id from another org shows ForbiddenState
  // immediately instead of sitting on a "Starting…" skeleton forever.
  const [{ data, fetching, error }] = useQuery({
    query: GET_WORKFLOW_RUN,
    variables: { id: params.runId },
  });

  if (fetching) return <p className="text-sm text-slate-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  const run = data?.workflow_runs?.[0];
  if (!run) return <ForbiddenState backHref={`/org/${orgId}/workflows`} />;

  return <RunViewerBody run={run} />;
}

function RunViewerBody({ run }: { run: any }) {
  const [liveStatus, setLiveStatus] = useState<string | null>(run.status);
  const status = liveStatus ?? run.status;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">{run.workflow?.name}</h1>
        <span className={`text-xs px-2 py-1 rounded ${RUN_STATUS_STYLES[status] ?? "bg-slate-100"}`}>{status}</span>
        <span className="text-xs text-slate-400">via {run.trigger_type}</span>
      </div>
      <RunStepList workflowRunId={run.id} onStatusChange={setLiveStatus} />
    </div>
  );
}
