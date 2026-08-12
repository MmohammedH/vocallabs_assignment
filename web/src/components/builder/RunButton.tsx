"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "urql";
import { useOrg } from "@/context/OrgContext";
import { RoleGate } from "@/components/common/RoleGate";
import { TRIGGER_WORKFLOW_RUN } from "@/lib/graphql/operations";

export function RunButton({ workflowId }: { workflowId: string }) {
  const { orgId } = useOrg();
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, executeTrigger] = useMutation(TRIGGER_WORKFLOW_RUN);

  async function onRun() {
    setRunning(true);
    setError(null);
    const result = await executeTrigger({ workflowId });
    setRunning(false);
    if (result.error) {
      setError(result.error.graphQLErrors[0]?.message ?? result.error.message);
      return;
    }
    const runId = result.data.triggerWorkflowRun.workflow_run_id;
    router.push(`/org/${orgId}/workflows/${workflowId}/runs/${runId}`);
  }

  return (
    // Hidden entirely for viewers — not disabled, structurally absent —
    // mirroring (not replacing) the server-side owner/editor check inside
    // the triggerWorkflowRun Action handler.
    <RoleGate allow={["owner", "editor"]}>
      <div className="flex items-center gap-2">
        {error && <span className="text-sm text-red-600">{error}</span>}
        <button onClick={onRun} disabled={running} className="rounded-md bg-emerald-600 text-white text-sm px-4 py-2 disabled:opacity-50">
          {running ? "Starting…" : "Run"}
        </button>
      </div>
    </RoleGate>
  );
}
