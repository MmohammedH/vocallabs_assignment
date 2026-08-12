"use client";

import { useEffect } from "react";
import { useSubscription } from "urql";
import { STEP_RUNS_SUBSCRIPTION } from "@/lib/graphql/operations";
import { RunStepItem } from "./RunStepItem";

// "Worst status wins" — derives a single overall badge from the live
// step_runs list, since we only subscribe to steps (not workflow_runs
// itself): any failed -> failed; any paused -> paused; anything still
// running/pending -> running; all succeeded -> completed.
function deriveOverallStatus(stepRuns: { status: string }[]): string | null {
  if (stepRuns.length === 0) return null;
  if (stepRuns.some((s) => s.status === "failed")) return "failed";
  if (stepRuns.some((s) => s.status === "paused")) return "paused";
  if (stepRuns.some((s) => s.status === "pending" || s.status === "running")) return "running";
  return "completed";
}

// The one live data source for the page — no polling. Layer 1 permissions
// still apply on top of the workflow_run_id filter, so subscribing with a
// foreign org's run id yields an empty, permanently-silent subscription
// rather than an error or a data leak.
export function RunStepList({
  workflowRunId,
  onStatusChange,
}: {
  workflowRunId: string;
  onStatusChange?: (status: string | null) => void;
}) {
  const [{ data, error }] = useSubscription({
    query: STEP_RUNS_SUBSCRIPTION,
    variables: { workflowRunId },
  });

  const stepRuns = data?.step_runs ?? [];

  useEffect(() => {
    onStatusChange?.(deriveOverallStatus(stepRuns));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(stepRuns.map((s: any) => s.status))]);

  if (error) return <p className="text-sm text-red-600">{error.message}</p>;
  if (stepRuns.length === 0) {
    return <p className="text-sm text-slate-500">Starting…</p>;
  }

  return (
    <div className="space-y-2">
      {stepRuns.map((sr: any) => (
        <RunStepItem key={sr.id} stepRun={sr} />
      ))}
    </div>
  );
}
