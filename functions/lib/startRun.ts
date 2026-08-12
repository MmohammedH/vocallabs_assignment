import { adminGql } from "./gql";
import { getUsage } from "./quota";
import { runSteps } from "./runSteps";

// Shared by every trigger path (manual, webhook, scheduled, database event):
// quota-check, create the workflow_run, run the executor, report final status.
export async function startRun(opts: {
  workflowId: string;
  orgId: string;
  triggerType: "manual" | "webhook" | "scheduled" | "database_event";
  triggeredBy?: string | null;
  input?: any;
}): Promise<{ runId: string; status: string; quotaExceeded?: boolean }> {
  const usage = await getUsage(opts.orgId);
  if (usage.remaining <= 0) {
    return { runId: "", status: "quota_exceeded", quotaExceeded: true };
  }

  const runData = await adminGql<{ insert_workflow_runs_one: { id: string } }>(
    `mutation($object: workflow_runs_insert_input!) {
       insert_workflow_runs_one(object: $object) { id }
     }`,
    {
      object: {
        workflow_id: opts.workflowId,
        trigger_type: opts.triggerType,
        triggered_by: opts.triggeredBy ?? null,
        status: "running",
        started_at: new Date().toISOString(),
        input: opts.input ?? null,
      },
    }
  );
  const runId = runData.insert_workflow_runs_one.id;

  await runSteps(runId, 1);

  const final = await adminGql<{ workflow_runs_by_pk: { status: string } }>(
    `query($id: uuid!) { workflow_runs_by_pk(id: $id) { status } }`,
    { id: runId }
  );
  return { runId, status: final.workflow_runs_by_pk.status };
}
