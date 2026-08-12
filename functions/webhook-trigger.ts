import { adminGql } from "./lib/gql";
import { getUsage } from "./lib/quota";
import { runSteps } from "./lib/runSteps";

// Hasura Action: webhookTrigger(workflow_id: uuid!, secret: String!, payload: json)
// Public role — no user JWT required, since external systems call this.
// Authorization here is entirely secret-based: the caller must know the
// per-trigger secret configured when the webhook trigger was created.
// A wrong secret and a nonexistent workflow return the identical 401, so
// this endpoint never reveals whether a given workflow_id exists.
export default async (req: any, res: any) => {
  try {
    const { input } = req.body;
    const { workflow_id, secret, payload } = input;

    const data = await adminGql<{
      workflow_triggers: { id: string; config: any; workflow: { org_id: string } }[];
    }>(
      `query($workflowId: uuid!) {
         workflow_triggers(
           where: { workflow_id: { _eq: $workflowId }, type: { _eq: "webhook" }, is_enabled: { _eq: true } }
         ) { id config workflow { org_id } }
       }`,
      { workflowId: workflow_id }
    );
    const trigger = data.workflow_triggers[0];
    if (!trigger || trigger.config?.secret !== secret) {
      return res.status(401).json({ message: "invalid webhook trigger" });
    }
    const orgId = trigger.workflow.org_id;

    const usage = await getUsage(orgId);
    if (usage.remaining <= 0) {
      return res.status(403).json({ message: "organization usage quota exhausted for this period" });
    }

    const runData = await adminGql<{ insert_workflow_runs_one: { id: string } }>(
      `mutation($object: workflow_runs_insert_input!) {
         insert_workflow_runs_one(object: $object) { id }
       }`,
      {
        object: {
          workflow_id,
          trigger_type: "webhook",
          status: "running",
          started_at: new Date().toISOString(),
          input: payload ?? null,
        },
      }
    );
    const runId = runData.insert_workflow_runs_one.id;

    await runSteps(runId, 1);

    const final = await adminGql<{ workflow_runs_by_pk: { status: string } }>(
      `query($id: uuid!) { workflow_runs_by_pk(id: $id) { status } }`,
      { id: runId }
    );
    res.status(200).json({ workflow_run_id: runId, status: final.workflow_runs_by_pk.status });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ message: err.message || "internal error" });
  }
};
